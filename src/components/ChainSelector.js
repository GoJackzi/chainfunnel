'use client';

import { useState, useEffect } from 'react';
import { getChains, POPULAR_CHAINS } from '@/lib/relay';

export default function ChainSelector({ value, onChange, label }) {
    const [open, setOpen] = useState(false);
    const [chains, setChains] = useState(POPULAR_CHAINS);
    const [allChains, setAllChains] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const loadAllChains = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getChains();
            const chainList = (Array.isArray(data) ? data : []).map((c) => ({
                id: c.id || c.chainId,
                name: c.name || c.displayName || `Chain ${c.id}`,
                icon: getChainEmoji(c.id || c.chainId, c.name),
                iconUrl: c.icon?.url || c.iconUrl || null,
            }));
            setAllChains(chainList);
            setChains(chainList);
        } catch (err) {
            console.error('Failed to load chains:', err);
            // Keep using popular chains as fallback
            setAllChains(POPULAR_CHAINS);
        }
        setLoading(false);
    }, []);

    // Load ALL chains from Relay API on first open
    useEffect(() => {
        if (open && allChains.length === 0) {
            loadAllChains();
        }
    }, [open, allChains.length, loadAllChains]);

    const filteredChains = search
        ? (allChains.length > 0 ? allChains : chains).filter(
            (c) =>
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                String(c.id).includes(search)
        )
        : allChains.length > 0
            ? allChains
            : chains;

    const selected =
        (allChains.length > 0 ? allChains : chains).find((c) => c.id === value) ||
        POPULAR_CHAINS.find((c) => c.id === value);

    return (
        <div className="input-group">
            {label && <span className="input-label">{label}</span>}
            <button
                className="selector-trigger"
                onClick={() => setOpen(true)}
                type="button"
            >
                <span className="selector-icon">
                    {selected?.iconUrl ? (
                        <img
                            src={selected.iconUrl}
                            alt={selected.name}
                            style={{ width: 18, height: 18, borderRadius: '50%' }}
                            // eslint-disable-next-line @next/next/no-img-element
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling && (e.target.nextSibling.style.display = 'inline');
                            }}
                        />
                    ) : (
                        selected?.icon || '🔗'
                    )}
                </span>
                <span className="selector-name">
                    {selected ? selected.name : 'Select chain'}
                </span>
                <span className="selector-chevron">▾</span>
            </button>

            {open && (
                <div className="dropdown-overlay" onClick={() => { setOpen(false); setSearch(''); }}>
                    <div className="dropdown-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown-search">
                            <input
                                placeholder="Search all chains..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="dropdown-list">
                            {loading ? (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="spinner"></div>
                                    <div className="empty-subtext" style={{ marginTop: 8 }}>Loading all chains...</div>
                                </div>
                            ) : filteredChains.length === 0 ? (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="empty-text">No chains found</div>
                                </div>
                            ) : (
                                filteredChains.map((chain) => (
                                    <div
                                        key={chain.id}
                                        className="dropdown-item"
                                        onClick={() => {
                                            onChange(chain.id);
                                            setOpen(false);
                                            setSearch('');
                                        }}
                                    >
                                        <div className="dropdown-item-icon">
                                            {chain.iconUrl ? (
                                                <img
                                                    src={chain.iconUrl}
                                                    alt={chain.name}
                                                    style={{ width: 20, height: 20, borderRadius: '50%' }}
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    onError={(e) => { e.target.textContent = chain.icon || '🔗'; }}
                                                />
                                            ) : (
                                                chain.icon || '🔗'
                                            )}
                                        </div>
                                        <div className="dropdown-item-info">
                                            <div className="dropdown-item-name">{chain.name}</div>
                                            <div className="dropdown-item-sub">Chain ID: {chain.id}</div>
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

function getChainEmoji(chainId, name) {
    const map = {
        1: '⟠', 8453: '🔵', 42161: '🔷', 10: '🔴', 137: '💜',
        324: '🔲', 59144: '🟢', 534352: '📜', 56: '🟡', 43114: '🔺',
        250: '👻', 100: '🟩', 42220: '🌿', 1101: '🟣', 5000: '🟤',
        7777777: '⚡', 81457: '🔥', 34443: '🌊', 169: '🦊',
    };
    return map[chainId] || '🔗';
}
