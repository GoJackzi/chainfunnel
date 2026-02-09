'use client';

import { useState, useEffect, useCallback } from 'react';
import { POPULAR_CHAINS } from '@/lib/relay';

export default function ChainSelector({ value, onChange, label }) {
    const [open, setOpen] = useState(false);
    const [chains, setChains] = useState(POPULAR_CHAINS);

    const selected = chains.find((c) => c.id === value);

    return (
        <div className="input-group">
            {label && <span className="input-label">{label}</span>}
            <button
                className="selector-trigger"
                onClick={() => setOpen(true)}
                type="button"
            >
                <span className="selector-icon">
                    {selected ? selected.icon : '🔗'}
                </span>
                <span className="selector-name">
                    {selected ? selected.name : 'Select chain'}
                </span>
                <span className="selector-chevron">▾</span>
            </button>

            {open && (
                <div className="dropdown-overlay" onClick={() => setOpen(false)}>
                    <div className="dropdown-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="dropdown-search">
                            <input placeholder="Search chains..." autoFocus />
                        </div>
                        <div className="dropdown-list">
                            {chains.map((chain) => (
                                <div
                                    key={chain.id}
                                    className="dropdown-item"
                                    onClick={() => {
                                        onChange(chain.id);
                                        setOpen(false);
                                    }}
                                >
                                    <div className="dropdown-item-icon">{chain.icon}</div>
                                    <div className="dropdown-item-info">
                                        <div className="dropdown-item-name">{chain.name}</div>
                                        <div className="dropdown-item-sub">Chain ID: {chain.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
