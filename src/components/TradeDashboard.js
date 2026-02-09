'use client';

import { useState } from 'react';
import { POPULAR_CHAINS } from '@/lib/relay';

const BLOCK_EXPLORERS = {
    1: 'https://etherscan.io',
    8453: 'https://basescan.org',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    137: 'https://polygonscan.com',
    324: 'https://explorer.zksync.io',
    59144: 'https://lineascan.build',
    534352: 'https://scrollscan.com',
    56: 'https://bscscan.com',
    43114: 'https://snowtrace.io',
};

function getExplorerUrl(chainId, txHash) {
    const base = BLOCK_EXPLORERS[chainId] || 'https://etherscan.io';
    return `${base}/tx/${txHash}`;
}

function getChainName(chainId) {
    const chain = POPULAR_CHAINS.find((c) => c.id === chainId);
    return chain?.name || `Chain ${chainId}`;
}

function getChainIcon(chainId) {
    const chain = POPULAR_CHAINS.find((c) => c.id === chainId);
    return chain?.icon || '🔗';
}

function getStatusBadge(status) {
    switch (status) {
        case 'quoting':
        case 'signing':
        case 'starting':
            return { className: 'status-pending', label: status.toUpperCase() };
        case 'executing':
            return { className: 'status-executing', label: 'EXECUTING' };
        case 'complete':
            return { className: 'status-complete', label: 'COMPLETE' };
        case 'failed':
        case 'error':
            return { className: 'status-failed', label: 'FAILED' };
        default:
            return { className: 'status-pending', label: status?.toUpperCase() || 'PENDING' };
    }
}

function getProgressClass(status) {
    switch (status) {
        case 'quoting':
        case 'signing':
        case 'starting':
            return 'pending';
        case 'executing':
            return 'executing';
        case 'complete':
            return 'complete';
        case 'failed':
        case 'error':
            return 'failed';
        default:
            return 'pending';
    }
}

export default function TradeDashboard({ trades }) {
    return (
        <div className="glass-card" style={{ background: 'var(--gradient-success)' }}>
            <div className="card-header">
                <div className="card-title">
                    <span className="card-title-icon">📊</span>
                    Dashboard
                </div>
                <span className="card-badge badge-count">
                    {trades.length} {trades.length === 1 ? 'TRADE' : 'TRADES'}
                </span>
            </div>

            <div className="card-body">
                {trades.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📊</div>
                        <div className="empty-text">No active trades</div>
                        <div className="empty-subtext">
                            Build a trade and execute it to see status here
                        </div>
                    </div>
                ) : (
                    <div>
                        {trades.map((trade, idx) => {
                            const badge = getStatusBadge(trade.status);
                            const progressClass = getProgressClass(trade.status);

                            return (
                                <div key={idx} className="trade-status-item">
                                    <div className="trade-status-header">
                                        <span className="trade-status-pair">
                                            {trade.legIndex !== undefined &&
                                                `Leg ${trade.legIndex + 1}/${trade.totalLegs}`}
                                        </span>
                                        <span className={`trade-status-badge ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                    </div>

                                    <div className="trade-progress">
                                        <div
                                            className={`trade-progress-bar ${progressClass}`}
                                        ></div>
                                    </div>

                                    <div className="trade-status-details">
                                        <span>{trade.message}</span>
                                        {trade.txHash && (
                                            <a
                                                href={getExplorerUrl(trade.originChainId, trade.txHash)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: 'var(--accent-cyan)',
                                                    textDecoration: 'none',
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    fontSize: '11px',
                                                }}
                                            >
                                                {trade.txHash.slice(0, 8)}...{trade.txHash.slice(-6)} ↗
                                            </a>
                                        )}
                                        {trade.requestId && !trade.txHash && (
                                            <span
                                                className="mono"
                                                style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                                            >
                                                {trade.requestId.slice(0, 10)}...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Stats section at bottom */}
                {trades.length > 0 && (
                    <div
                        style={{
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border-primary)',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '2px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    fontWeight: 600,
                                }}
                            >
                                Completed
                            </div>
                            <div
                                style={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: 'var(--accent-green)',
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                {trades.filter((t) => t.status === 'complete').length}
                            </div>
                        </div>
                        <div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: 'var(--text-muted)',
                                    marginBottom: '2px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    fontWeight: 600,
                                }}
                            >
                                In Progress
                            </div>
                            <div
                                style={{
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    color: 'var(--accent-cyan)',
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                {
                                    trades.filter(
                                        (t) =>
                                            t.status === 'executing' ||
                                            t.status === 'quoting' ||
                                            t.status === 'signing'
                                    ).length
                                }
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
