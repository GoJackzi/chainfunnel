'use client';

import { useState, useEffect, useCallback } from 'react';
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

    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient({ chainId: chainId || undefined });

    // Load tokens when chain changes
    useEffect(() => {
        if (!chainId) return;
        loadTokens();
    }, [chainId]);

    // Fetch balances when dropdown opens and we have tokens
    useEffect(() => {
        if (open && tokens.length > 0 && isConnected && address && chainId) {
            fetchAllBalances();
        }
    }, [open, tokens.length, isConnected, address, chainId]);

    const loadTokens = async () => {
        setLoading(true);
        try {
            const data = await getCurrencies(chainId, { limit: 100, verified: true });
            let tokenList = [];

            if (Array.isArray(data)) {
                tokenList = data;
            } else if (data?.currencies) {
                tokenList = data.currencies;
            } else if (data) {
                // Try to extract tokens from various response formats
                const keys = Object.keys(data);
                for (const key of keys) {
                    if (Array.isArray(data[key])) {
                        tokenList = data[key];
                        break;
                    }
                }
            }

            // Deduplicate by address
            const seen = new Set();
            tokenList = tokenList.filter((t) => {
                const addr = (t.address || NATIVE_TOKEN).toLowerCase();
                if (seen.has(addr)) return false;
                seen.add(addr);
                return true;
            });

            setTokens(tokenList);
        } catch (err) {
            console.error('Failed to load tokens:', err);
            setTokens([
                { address: NATIVE_TOKEN, symbol: 'ETH', name: 'Ethereum', decimals: 18 },
            ]);
        }
        setLoading(false);
    };

    const searchTokens = async (term) => {
        if (!chainId || !term) return;
        setLoading(true);
        try {
            const data = await getCurrencies(chainId, { term, limit: 30 });
            let tokenList = Array.isArray(data)
                ? data
                : data?.currencies || [];
            setTokens(tokenList);
        } catch {
            /* ignore */
        }
        setLoading(false);
    };

    const fetchAllBalances = async () => {
        if (!publicClient || !address) return;
        setBalancesLoading(true);

        try {
            const newBalances = {};

            // Separate native and ERC20 tokens
            const erc20Tokens = tokens.filter((t) => {
                const addr = t.address || '';
                return (
                    addr &&
                    addr !== NATIVE_TOKEN &&
                    addr !== '0x0000000000000000000000000000000000000000'
                );
            });

            // Fetch native balance
            try {
                const nativeBalance = await publicClient.getBalance({ address });
                newBalances[NATIVE_TOKEN] = nativeBalance;
                newBalances['0x0000000000000000000000000000000000000000'] = nativeBalance;
            } catch (e) {
                console.error('Native balance error:', e);
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
                            newBalances[token.address.toLowerCase()] = result.result;
                        }
                    });
                } catch (e) {
                    console.error('Multicall error, falling back:', e);
                    // Fallback: fetch one by one for first 10
                    for (const token of erc20Tokens.slice(0, 10)) {
                        try {
                            const balance = await publicClient.readContract({
                                address: token.address,
                                abi: ERC20_BALANCE_ABI,
                                functionName: 'balanceOf',
                                args: [address],
                            });
                            newBalances[token.address.toLowerCase()] = balance;
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
    };

    const getTokenBalance = (token) => {
        const addr = (token.address || NATIVE_TOKEN).toLowerCase();
        const raw = balances[addr];
        if (raw === undefined || raw === null) return null;
        const decimals = token.decimals || 18;
        try {
            const formatted = formatUnits(raw, decimals);
            return parseFloat(formatted);
        } catch {
            return null;
        }
    };

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearch(term);
        if (term.length >= 2) {
            searchTokens(term);
        } else if (term.length === 0) {
            loadTokens();
        }
    };

    const selected = tokens.find(
        (t) =>
            (t.address || '').toLowerCase() === (value || '').toLowerCase()
    );

    // Sort tokens: those with balance first, then by balance descending
    const sortedTokens = [...tokens].sort((a, b) => {
        const balA = getTokenBalance(a);
        const balB = getTokenBalance(b);
        if (balA !== null && balA > 0 && (balB === null || balB === 0)) return -1;
        if (balB !== null && balB > 0 && (balA === null || balA === 0)) return 1;
        if (balA !== null && balB !== null) return balB - balA;
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
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : (
                        '🪙'
                    )}
                </span>
                <span className="selector-name">
                    {selected ? selected.symbol : chainId ? 'Select token' : 'Select chain first'}
                </span>
                <span className="selector-chevron">▾</span>
            </button>

            {open && (
                <div className="dropdown-overlay" onClick={() => { setOpen(false); setSearch(''); }}>
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
                                                        onError={(e) => { e.target.style.display = 'none'; }}
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
                            <div
                                style={{
                                    padding: '8px 16px',
                                    borderTop: '1px solid var(--border-primary)',
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span>{tokens.length} tokens available</span>
                                {balancesLoading ? (
                                    <span>Loading balances...</span>
                                ) : (
                                    <span>Balances loaded</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
