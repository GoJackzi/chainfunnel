'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import ChainSelector from './ChainSelector';
import TokenSelector from './TokenSelector';
import { getQuote, formatUsd, NATIVE_TOKEN, APP_FEE_BPS } from '@/lib/relay';
import { executeMultiLeg } from '@/lib/execution';

let legIdCounter = 0;

function createEmptyLeg() {
    return {
        id: ++legIdCounter,
        originChainId: null,
        originCurrency: null,
        originToken: null,
        destinationChainId: null,
        destinationCurrency: null,
        destinationToken: null,
        amount: '',
        quote: null,
        quoteLoading: false,
        quoteError: null,
    };
}

export default function TradeBuilder({ onTradeUpdate }) {
    const [legs, setLegs] = useState([createEmptyLeg()]);
    const [executing, setExecuting] = useState(false);
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();

    const updateLeg = (legId, updates) => {
        setLegs((prev) =>
            prev.map((leg) => (leg.id === legId ? { ...leg, ...updates } : leg))
        );
    };

    const addLeg = () => {
        setLegs((prev) => [...prev, createEmptyLeg()]);
    };

    const removeLeg = (legId) => {
        setLegs((prev) => prev.filter((leg) => leg.id !== legId));
    };

    const fetchQuote = async (leg) => {
        if (
            !leg.originChainId ||
            !leg.originCurrency ||
            !leg.destinationChainId ||
            !leg.destinationCurrency ||
            !leg.amount
        )
            return;

        updateLeg(leg.id, { quoteLoading: true, quoteError: null });

        try {
            const decimals = leg.originToken?.decimals || 18;
            const rawAmount = BigInt(
                Math.floor(parseFloat(leg.amount) * 10 ** decimals)
            ).toString();

            const quote = await getQuote({
                user: address || '0x0000000000000000000000000000000000000000',
                originChainId: leg.originChainId,
                originCurrency: leg.originCurrency,
                destinationChainId: leg.destinationChainId,
                destinationCurrency: leg.destinationCurrency,
                amount: rawAmount,
            });

            updateLeg(leg.id, { quote, quoteLoading: false });
        } catch (err) {
            updateLeg(leg.id, {
                quote: null,
                quoteLoading: false,
                quoteError: err.message,
            });
        }
    };

    const handleExecute = async () => {
        if (!walletClient || !isConnected) return;

        setExecuting(true);
        const validLegs = legs.filter(
            (l) =>
                l.originChainId &&
                l.originCurrency &&
                l.destinationChainId &&
                l.destinationCurrency &&
                l.amount
        );

        const executionLegs = validLegs.map((l) => {
            const decimals = l.originToken?.decimals || 18;
            return {
                id: l.id,
                originChainId: l.originChainId,
                originCurrency: l.originCurrency,
                destinationChainId: l.destinationChainId,
                destinationCurrency: l.destinationCurrency,
                amount: BigInt(
                    Math.floor(parseFloat(l.amount) * 10 ** decimals)
                ).toString(),
            };
        });

        try {
            const results = await executeMultiLeg(
                executionLegs,
                walletClient,
                (update) => {
                    onTradeUpdate?.(update);
                }
            );
        } catch (err) {
            console.error('Execution error:', err);
        }
        setExecuting(false);
    };

    const totalFeesUsd = legs.reduce((sum, leg) => {
        const feeUsd = parseFloat(leg.quote?.fees?.relayer?.amountUsd || '0');
        return sum + feeUsd;
    }, 0);

    const totalOutputUsd = legs.reduce((sum, leg) => {
        const outUsd = parseFloat(leg.quote?.details?.currencyOut?.amountUsd || '0');
        return sum + outUsd;
    }, 0);

    const allQuoted = legs.every((l) => l.quote) && legs.length > 0;
    const canExecute = isConnected && allQuoted && !executing;

    return (
        <div className="glass-card">
            <div className="card-header">
                <div className="card-title">
                    <span className="card-title-icon">🔀</span>
                    Trade Builder
                </div>
                <span className="card-badge badge-count">
                    {legs.length} {legs.length === 1 ? 'LEG' : 'LEGS'}
                </span>
            </div>

            <div className="card-body">
                {legs.map((leg, index) => (
                    <div key={leg.id} className="trade-leg">
                        <div className="leg-header">
                            <span className="leg-number">LEG {index + 1}</span>
                            {legs.length > 1 && (
                                <button
                                    className="leg-remove"
                                    onClick={() => removeLeg(leg.id)}
                                    title="Remove leg"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="leg-flow">
                            <div className="leg-side">
                                <ChainSelector
                                    label="From Chain"
                                    value={leg.originChainId}
                                    onChange={(chainId) =>
                                        updateLeg(leg.id, {
                                            originChainId: chainId,
                                            originCurrency: null,
                                            originToken: null,
                                            quote: null,
                                        })
                                    }
                                />
                                <TokenSelector
                                    label="Token"
                                    chainId={leg.originChainId}
                                    value={leg.originCurrency}
                                    onChange={(addr, token) =>
                                        updateLeg(leg.id, {
                                            originCurrency: addr,
                                            originToken: token,
                                            quote: null,
                                        })
                                    }
                                />
                                <div className="input-group">
                                    <span className="input-label">Amount</span>
                                    <input
                                        className="input-field"
                                        type="number"
                                        placeholder="0.0"
                                        value={leg.amount}
                                        onChange={(e) =>
                                            updateLeg(leg.id, { amount: e.target.value, quote: null })
                                        }
                                        onBlur={() => fetchQuote(leg)}
                                    />
                                </div>
                            </div>

                            <div className="leg-arrow">→</div>

                            <div className="leg-side">
                                <ChainSelector
                                    label="To Chain"
                                    value={leg.destinationChainId}
                                    onChange={(chainId) =>
                                        updateLeg(leg.id, {
                                            destinationChainId: chainId,
                                            destinationCurrency: null,
                                            destinationToken: null,
                                            quote: null,
                                        })
                                    }
                                />
                                <TokenSelector
                                    label="Token"
                                    chainId={leg.destinationChainId}
                                    value={leg.destinationCurrency}
                                    onChange={(addr, token) =>
                                        updateLeg(leg.id, {
                                            destinationCurrency: addr,
                                            destinationToken: token,
                                            quote: null,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        {/* Quote display */}
                        {leg.quoteLoading && (
                            <div className="leg-quote">
                                <span className="leg-quote-label">Fetching quote...</span>
                                <span className="spinner"></span>
                            </div>
                        )}
                        {leg.quoteError && (
                            <div className="leg-quote">
                                <span className="leg-quote-label" style={{ color: 'var(--accent-red)' }}>
                                    {leg.quoteError}
                                </span>
                            </div>
                        )}
                        {leg.quote && (
                            <div className="leg-quote">
                                <span className="leg-quote-label">
                                    You receive ~{formatUsd(leg.quote.details?.currencyOut?.amountUsd)}
                                </span>
                                <span className="leg-quote-value neutral">
                                    Fee: {formatUsd(leg.quote.fees?.relayer?.amountUsd)}
                                </span>
                            </div>
                        )}
                    </div>
                ))}

                <button className="btn btn-ghost btn-full" onClick={addLeg} style={{ marginBottom: '16px' }}>
                    + Add Trade Leg
                </button>

                {legs.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div className="leg-quote" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                            <span className="leg-quote-label">Total Output</span>
                            <span className="leg-quote-value positive">
                                {totalOutputUsd > 0 ? formatUsd(totalOutputUsd.toString()) : '—'}
                            </span>
                        </div>
                        <div className="leg-quote" style={{ borderTop: 'none', marginTop: 0, paddingTop: 4 }}>
                            <span className="leg-quote-label">Total Fees</span>
                            <span className="leg-quote-value neutral">
                                {totalFeesUsd > 0 ? formatUsd(totalFeesUsd.toString()) : '—'}
                            </span>
                        </div>
                    </div>
                )}

                <button
                    className="btn btn-primary btn-lg btn-full"
                    onClick={handleExecute}
                    disabled={!canExecute}
                >
                    {executing ? (
                        <>
                            <span className="spinner"></span>
                            Executing...
                        </>
                    ) : !isConnected ? (
                        'Connect Wallet to Execute'
                    ) : !allQuoted ? (
                        'Get Quotes First'
                    ) : (
                        `⚡ Execute ${legs.length} ${legs.length === 1 ? 'Trade' : 'Trades'}`
                    )}
                </button>

                <div className="fee-info">
                    💰 Platform fee: {(parseInt(APP_FEE_BPS) / 100).toFixed(1)}% on each trade (collected by Relay)
                </div>
            </div>
        </div>
    );
}
