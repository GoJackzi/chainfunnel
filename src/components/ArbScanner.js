'use client';

import { useState, useEffect, useRef } from 'react';
import { scanArbitrage, getChainIcon } from '@/lib/arbScanner';

export default function ArbScanner({ onSelectOpportunity }) {
    const [opportunities, setOpportunities] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [lastScan, setLastScan] = useState(null);
    const scanRef = useRef(false);

    const startScan = useCallback(async () => {
        if (scanRef.current) return;
        scanRef.current = true;
        setScanning(true);
        setOpportunities([]);

        try {
            const results = await scanArbitrage((opp) => {
                setOpportunities((prev) => {
                    const updated = [...prev, opp];
                    updated.sort((a, b) => b.netProfitPercent - a.netProfitPercent);
                    return updated;
                });
            });
            setLastScan(new Date());
        } catch (err) {
            console.error('Scan error:', err);
        }

        setScanning(false);
        scanRef.current = false;
    }, []);

    useEffect(() => {
        startScan();
    }, [startScan]);

    return (
        <div className="glass-card" style={{ background: 'var(--gradient-scanner)' }}>
            <div className="card-header">
                <div className="card-title">
                    <span className="card-title-icon">📡</span>
                    Arb Scanner
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {scanning && <span className="card-badge badge-live">SCANNING</span>}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={startScan}
                        disabled={scanning}
                    >
                        {scanning ? '⟳' : '↻'} Refresh
                    </button>
                </div>
            </div>

            <div className="card-body" style={{ padding: '0' }}>
                {scanning && opportunities.length === 0 ? (
                    <div className="empty-state">
                        <div className="spinner" style={{ width: '24px', height: '24px', marginBottom: '12px' }}></div>
                        <div className="empty-text">Scanning prices across chains...</div>
                        <div className="empty-subtext">Checking ETH, USDC, USDT spreads</div>
                    </div>
                ) : opportunities.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📡</div>
                        <div className="empty-text">No opportunities found</div>
                        <div className="empty-subtext">Markets are efficient right now</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="arb-table">
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Route</th>
                                    <th>Spread</th>
                                    <th>Net</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {opportunities.map((opp, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div className="arb-token">
                                                <span className="arb-token-icon">{opp.tokenIcon}</span>
                                                <span style={{ fontWeight: 600 }}>{opp.token}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                                <span>{getChainIcon(opp.originChainId)}</span>
                                                <span className="arb-chain">{opp.originChainName}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                <span>{getChainIcon(opp.destinationChainId)}</span>
                                                <span className="arb-chain">{opp.destinationChainName}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                className={`arb-spread ${opp.spreadPercent > 0 ? 'positive' : 'negative'
                                                    }`}
                                            >
                                                {opp.spreadPercent > 0 ? '+' : ''}
                                                {opp.spreadPercent.toFixed(3)}%
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={`arb-spread ${opp.netProfitPercent > 0 ? 'positive' : 'negative'
                                                    }`}
                                            >
                                                {opp.netProfitUsd > 0 ? '+' : ''}$
                                                {opp.netProfitUsd.toFixed(2)}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="arb-action-btn"
                                                onClick={() => onSelectOpportunity?.(opp)}
                                            >
                                                Trade ↗
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {lastScan && (
                    <div
                        style={{
                            padding: '8px 20px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            borderTop: '1px solid var(--border-primary)',
                        }}
                    >
                        Last scan: {lastScan.toLocaleTimeString()} ·{' '}
                        {opportunities.length} pairs checked
                    </div>
                )}
            </div>
        </div>
    );
}
