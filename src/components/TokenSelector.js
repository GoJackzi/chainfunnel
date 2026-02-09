'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrencies, NATIVE_TOKEN } from '@/lib/relay';

export default function TokenSelector({ chainId, value, onChange, label }) {
    const [open, setOpen] = useState(false);
    const [tokens, setTokens] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!chainId) return;
        loadTokens();
    }, [chainId]);

    const loadTokens = async () => {
        setLoading(true);
        try {
            const data = await getCurrencies(chainId, { limit: 50 });
            const tokenList = Array.isArray(data) ? data : (data?.currencies || []);
            setTokens(tokenList);
        } catch (err) {
            console.error('Failed to load tokens:', err);
            // Fallback to native token
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
            const data = await getCurrencies(chainId, { term, limit: 20 });
            const tokenList = Array.isArray(data) ? data : (data?.currencies || []);
            setTokens(tokenList);
        } catch {
            /* ignore */
        }
        setLoading(false);
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
                    {selected ? selected.symbol : (chainId ? 'Select token' : 'Select chain first')}
                </span>
                <span className="selector-chevron">▾</span>
            </button>

            {open && (
                <div className="dropdown-overlay" onClick={() => setOpen(false)}>
                    <div className="dropdown-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown-search">
                            <input
                                placeholder="Search tokens..."
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
                            ) : tokens.length === 0 ? (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="empty-text">No tokens found</div>
                                </div>
                            ) : (
                                tokens.map((token, idx) => (
                                    <div
                                        key={`${token.address}-${idx}`}
                                        className="dropdown-item"
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
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
