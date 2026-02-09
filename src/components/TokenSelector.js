'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { getCurrencies, NATIVE_TOKEN } from '@/lib/relay';

const ERC20_BALANCE_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }],
    },
];

export default function TokenSelector({ chainId, value, onChange, label }) {
    const [open, setOpen] = useState(false);
    const [tokens, setTokens] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [balances, setBalances] = useState({});
    const [balancesLoading, setBalancesLoading] = useState(false);
    const loadedChainRef = useRef(null);

    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient({ chainId: chainId || undefined });

    const loadTokens = useCallback(async (cid) => {
        setLoading(true);
        setBalances({});
        try {
            const tokenList = await getCurrencies(cid, { limit: 100, verified: true });
            console.log(`[TokenSelector] Loaded ${tokenList.length} tokens for chain ${cid}`);
            setTokens(tokenList);
        } catch (err) {
            console.error('Failed to load tokens:', err);
            // Fallback with common tokens
            setTokens([
                {
                    address: NATIVE_TOKEN,
                    symbol: 'ETH',
                    name: 'Ethereum',
                    decimals: 18,
                    metadata: { isNative: true },
                },
            ]);
        }
        setLoading(false);
    }, []);

    // Load tokens when chain changes
    useEffect(() => {
        if (!chainId) {
            setTokens([]);
            setBalances({});
            return;
        }
        if (loadedChainRef.current !== chainId) {
            loadedChainRef.current = chainId;
            loadTokens(chainId);
        }
    }, [chainId, loadTokens]);

    const fetchAllBalances = useCallback(async () => {
        if (!publicClient || !address) return;
        setBalancesLoading(true);

        try {
            const newBalances = {};

            // Separate native and ERC20 tokens
            const nativeTokens = tokens.filter((t) => {
                const addr = (t.address || '').toLowerCase();
                return (
                    !addr ||
                    addr === NATIVE_TOKEN.toLowerCase() ||
                    t.metadata?.isNative === true
                );
            });

            const erc20Tokens = tokens.filter((t) => {
                const addr = (t.address || '').toLowerCase();
                return (
                    addr &&
                    addr !== NATIVE_TOKEN.toLowerCase() &&
                    t.metadata?.isNative !== true
                );
            });

            // Fetch native balance
            if (nativeTokens.length > 0) {
                try {
                    const nativeBalance = await publicClient.getBalance({ address });
                    newBalances[NATIVE_TOKEN.toLowerCase()] = {
                        raw: nativeBalance,
                        decimals: 18,
                    };
                } catch (e) {
                    console.error('Native balance error:', e);
                }
            }

            // Batch fetch ERC20 balances via multicall
            if (erc20Tokens.length > 0) {
                try {
                    const calls = erc20Tokens.map((token) => ({
                        address: token.address,
                        abi: ERC20_BALANCE_ABI,
                        functionName: 'balanceOf',
                        args: [address],
                    }));

                    const results = await publicClient.multicall({ contracts: calls });

                    results.forEach((result, idx) => {
                        const token = erc20Tokens[idx];
                        if (result.status === 'success') {
                            newBalances[token.address.toLowerCase()] = {
                                raw: result.result,
                                decimals: token.decimals || 18,
                            };
                        }
                    });
                } catch (e) {
                    console.error('Multicall error, falling back:', e);
                    // Fallback: fetch one by one for first 15
                    for (const token of erc20Tokens.slice(0, 15)) {
                        try {
                            const balance = await publicClient.readContract({
                                address: token.address,
                                abi: ERC20_BALANCE_ABI,
                                functionName: 'balanceOf',
                                args: [address],
                            });
                            newBalances[token.address.toLowerCase()] = {
                                raw: balance,
                                decimals: token.decimals || 18,
                            };
                        } catch {
                            /* skip */
                        }
                    }
                }
            }

            setBalances(newBalances);
        } catch (err) {
            console.error('Balance fetch error:', err);
        }
        setBalancesLoading(false);
    }, [tokens, publicClient, address]);

    // Fetch balances when dropdown opens
    useEffect(() => {
        if (open && tokens.length > 0 && isConnected && address && chainId && publicClient) {
            fetchAllBalances();
        }
    }, [open, tokens.length, isConnected, address, chainId, publicClient, fetchAllBalances]);

    const getTokenBalance = (token) => {
        const addr = (token.address || NATIVE_TOKEN).toLowerCase();
        const entry = balances[addr];
        if (!entry) return null;
        try {
            const formatted = formatUnits(entry.raw, entry.decimals);
            return parseFloat(formatted);
        } catch {
            return null;
        }
    };

    const getSelectedBalance = () => {
        if (!value) return null;
        const addr = value.toLowerCase();
        const entry = balances[addr];
        if (!entry) return null;
        try {
            return formatUnits(entry.raw, entry.decimals);
        } catch {
            return null;
        }
    };

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearch(term);
        // Client-side filter instead of API search for speed
    };

    const selected = tokens.find(
        (t) => (t.address || '').toLowerCase() === (value || '').toLowerCase()
    );

    // Filter tokens by search term
    const filteredTokens = search
        ? tokens.filter(
            (t) =>
                t.symbol?.toLowerCase().includes(search.toLowerCase()) ||
                t.name?.toLowerCase().includes(search.toLowerCase()) ||
                t.address?.toLowerCase().includes(search.toLowerCase())
        )
        : tokens;

    // Sort: tokens with balance > 0 first, then by balance descending
    const sortedTokens = [...filteredTokens].sort((a, b) => {
        const balA = getTokenBalance(a);
        const balB = getTokenBalance(b);
        const hasA = balA !== null && balA > 0;
        const hasB = balB !== null && balB > 0;
        if (hasA && !hasB) return -1;
        if (hasB && !hasA) return 1;
        if (hasA && hasB) return balB - balA;
        return 0;
    });

    const formatBal = (num) => {
        if (num === null || num === undefined) return '';
        if (num === 0) return '0';
        if (num < 0.0001) return '<0.0001';
        if (num < 1) return num.toFixed(4);
        if (num < 1000) return num.toFixed(3);
        if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
        return (num / 1000000).toFixed(2) + 'M';
    };

    // Get selected token balance for external display
    const selectedBal = getSelectedBalance();

    return (
        <div className="input-group">
            {label && <span className="input-label">{label}</span>}
            <button
                className="selector-trigger"
                onClick={() => chainId && setOpen(true)}
                type="button"
                disabled={!chainId}
                style={!chainId ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
                <span className="selector-icon">
                    {selected?.metadata?.logoURI ? (
                        <img
                            src={selected.metadata.logoURI}
                            alt={selected.symbol}
                            // eslint-disable-next-line @next/next/no-img-element
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        '🪙'
                    )}
                </span>
                <span className="selector-name">
                    {selected ? selected.symbol : chainId ? 'Select token' : 'Select chain first'}
                </span>
                {selected && selectedBal !== null && (
                    <span className="selector-balance">
                        {formatBal(parseFloat(selectedBal))}
                    </span>
                )}
                <span className="selector-chevron">▾</span>
            </button>

            {open && (
                <div
                    className="dropdown-overlay"
                    onClick={() => {
                        setOpen(false);
                        setSearch('');
                    }}
                >
                    <div className="dropdown-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown-search">
                            <input
                                placeholder="Search tokens by name or address..."
                                value={search}
                                onChange={handleSearch}
                                autoFocus
                            />
                        </div>
                        <div className="dropdown-list">
                            {loading ? (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="spinner"></div>
                                </div>
                            ) : sortedTokens.length === 0 ? (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="empty-text">No tokens found</div>
                                </div>
                            ) : (
                                sortedTokens.map((token, idx) => {
                                    const bal = getTokenBalance(token);
                                    const hasBal = bal !== null && bal > 0;

                                    return (
                                        <div
                                            key={`${token.address}-${idx}`}
                                            className={`dropdown-item ${hasBal ? 'has-balance' : ''}`}
                                            onClick={() => {
                                                onChange(token.address || NATIVE_TOKEN, token);
                                                setOpen(false);
                                                setSearch('');
                                            }}
                                        >
                                            <div className="dropdown-item-icon">
                                                {token.metadata?.logoURI ? (
                                                    <img
                                                        src={token.metadata.logoURI}
                                                        alt={token.symbol}
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                ) : (
                                                    '🪙'
                                                )}
                                            </div>
                                            <div className="dropdown-item-info">
                                                <div className="dropdown-item-name">{token.symbol}</div>
                                                <div className="dropdown-item-sub">{token.name}</div>
                                            </div>
                                            <div className="dropdown-item-balance">
                                                {balancesLoading ? (
                                                    <span className="balance-loading">···</span>
                                                ) : bal !== null ? (
                                                    <span className={`token-bal ${hasBal ? 'has-funds' : 'zero'}`}>
                                                        {formatBal(bal)}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {isConnected && (
                            <div className="dropdown-footer">
                                <span>{tokens.length} tokens available</span>
                                {balancesLoading ? (
                                    <span>Loading balances...</span>
                                ) : (
                                    <span>Balances loaded ✓</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
