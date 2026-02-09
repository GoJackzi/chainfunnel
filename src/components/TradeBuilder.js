'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
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

// Balance hook using publicClient
function useLegBalance(chainId, tokenAddress) {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient({ chainId: chainId || undefined });
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isConnected || !address || !chainId || !tokenAddress || !publicClient) {
            setBalance(null);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const fetchBalance = async () => {
            try {
                const isNative =
                    !tokenAddress ||
                    tokenAddress === NATIVE_TOKEN ||
                    tokenAddress === '0x0000000000000000000000000000000000000000';

                let raw;
                let decimals = 18;

                if (isNative) {
                    raw = await publicClient.getBalance({ address });
                } else {
                    raw = await publicClient.readContract({
                        address: tokenAddress,
                        abi: [{
                            name: 'balanceOf', type: 'function', stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ name: 'balance', type: 'uint256' }],
                        }],
                        functionName: 'balanceOf',
                        args: [address],
                    });
                    try {
                        decimals = await publicClient.readContract({
                            address: tokenAddress,
                            abi: [{
                                name: 'decimals', type: 'function', stateMutability: 'view',
                                inputs: [], outputs: [{ name: '', type: 'uint8' }],
                            }],
                            functionName: 'decimals',
                        });
                    } catch { decimals = 18; }
                }

                if (!cancelled) {
                    const formatted = formatUnits(raw, Number(decimals));
                    setBalance(formatted);
                }
            } catch (err) {
                if (!cancelled) setBalance(null);
            }
            if (!cancelled) setLoading(false);
        };

        fetchBalance();
        return () => { cancelled = true; };
    }, [chainId, tokenAddress, address, isConnected]);

    return { balance, loading };
}

function LegBalanceDisplay({ chainId, tokenAddress, tokenSymbol, onMax }) {
    const { balance, loading } = useLegBalance(chainId, tokenAddress);
    const { isConnected } = useAccount();

    if (!isConnected || !chainId || !tokenAddress) return null;

    const num = balance ? parseFloat(balance) : 0;
    const symbol = tokenSymbol || 'ETH';

    return (
        <div className="balance-display">
            <span className="balance-label">Balance:</span>
            {loading ? (
                <span className="balance-value">...</span>
            ) : (
                <>
                    <span className="balance-value">
                        {num < 0.0001 && num > 0 ? '<0.0001' : num.toFixed(4)} {symbol}
                    </span>
                    {num > 0 && (
                        <button className="balance-max-btn" onClick={() => onMax(balance)} type="button">
                            MAX
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// Step indicator
function StepIndicator({ leg }) {
    const steps = [
        { label: 'From', done: !!leg.originChainId },
        { label: 'Token', done: !!leg.originCurrency },
        { label: 'Amount', done: !!leg.amount && parseFloat(leg.amount) > 0 },
        { label: 'To', done: !!leg.destinationChainId && !!leg.destinationCurrency },
    ];

    const completedCount = steps.filter((s) => s.done).length;
    const allDone = completedCount === steps.length;

    return (
        <div className="step-indicator">
            {steps.map((step, i) => (
                <div key={i} className={`step-dot ${step.done ? 'done' : ''} ${!step.done && i === completedCount ? 'active' : ''}`}>
                    <div className="step-circle">
                        {step.done ? '✓' : i + 1}
                    </div>
                    <span className="step-label">{step.label}</span>
                    {i < steps.length - 1 && <div className={`step-line ${step.done ? 'done' : ''}`} />}
                </div>
            ))}
        </div>
    );
}

export default function TradeBuilder({ onTradeUpdate }) {
    const [legs, setLegs] = useState([createEmptyLeg()]);
    const [executing, setExecuting] = useState(false);
    const [quotingAll, setQuotingAll] = useState(false);
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

    const isLegReady = (leg) =>
        leg.originChainId &&
        leg.originCurrency &&
        leg.destinationChainId &&
        leg.destinationCurrency &&
        leg.amount &&
        parseFloat(leg.amount) > 0;

    const fetchQuoteForLeg = async (leg) => {
        if (!isLegReady(leg)) return null;

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
            return quote;
        } catch (err) {
            updateLeg(leg.id, {
                quote: null,
                quoteLoading: false,
                quoteError: err.message,
            });
            return null;
        }
    };

    // Fetch quotes for ALL legs at once
    const fetchAllQuotes = async () => {
        setQuotingAll(true);
        const readyLegs = legs.filter(isLegReady);

        await Promise.all(readyLegs.map((leg) => fetchQuoteForLeg(leg)));
        setQuotingAll(false);
    };

    const handleExecute = async () => {
        if (!walletClient || !isConnected) return;

        setExecuting(true);
        const validLegs = legs.filter((l) => isLegReady(l) && l.quote);

        const executionLegs = validLegs.map((l) => {
            const decimals = l.originToken?.decimals || 18;
            return {
                id: l.id,
                originChainId: l.originChainId,
                originCurrency: l.originCurrency,
                destinationChainId: l.destinationChainId,
                destinationCurrency: l.destinationCurrency,
                amount: BigInt(Math.floor(parseFloat(l.amount) * 10 ** decimals)).toString(),
            };
        });

        try {
            await executeMultiLeg(executionLegs, walletClient, (update) => {
                onTradeUpdate?.(update);
            });
        } catch (err) {
            console.error('Execution error:', err);
        }
        setExecuting(false);
    };

    const totalFeesUsd = legs.reduce((sum, leg) => {
        return sum + parseFloat(leg.quote?.fees?.relayer?.amountUsd || '0');
    }, 0);

    const totalOutputUsd = legs.reduce((sum, leg) => {
        return sum + parseFloat(leg.quote?.details?.currencyOut?.amountUsd || '0');
    }, 0);

    const allQuoted = legs.every((l) => l.quote) && legs.length > 0;
    const anyReady = legs.some(isLegReady);
    const anyQuoting = legs.some((l) => l.quoteLoading) || quotingAll;
    const canExecute = isConnected && allQuoted && !executing;

    // Determine button state
    const getButtonContent = () => {
        if (executing) {
            return { text: 'Executing...', icon: '⏳', disabled: true, onClick: null, style: 'executing' };
        }
        if (!isConnected) {
            return { text: 'Connect Wallet First', icon: '🔌', disabled: true, onClick: null, style: 'disabled' };
        }
        if (anyQuoting) {
            return { text: 'Fetching Quotes...', icon: '⏳', disabled: true, onClick: null, style: 'loading' };
        }
        if (!anyReady) {
            return { text: 'Fill in trade details above', icon: '👆', disabled: true, onClick: null, style: 'disabled' };
        }
        if (!allQuoted) {
            return { text: '🔍 Get Quotes', icon: null, disabled: false, onClick: fetchAllQuotes, style: 'quote' };
        }
        return {
            text: `⚡ Execute ${legs.length} ${legs.length === 1 ? 'Trade' : 'Trades'}`,
            icon: null,
            disabled: false,
            onClick: handleExecute,
            style: 'execute',
        };
    };

    const btn = getButtonContent();

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
                                <button className="leg-remove" onClick={() => removeLeg(leg.id)} title="Remove leg">
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Step Indicator */}
                        <StepIndicator leg={leg} />

                        <div className="leg-flow">
                            <div className="leg-side">
                                <ChainSelector
                                    label="① From Chain"
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
                                    label="② Token to Send"
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
                                    <div className="input-label-row">
                                        <span className="input-label">③ Amount</span>
                                    </div>
                                    <input
                                        className="input-field"
                                        type="number"
                                        placeholder="0.0"
                                        value={leg.amount}
                                        onChange={(e) =>
                                            updateLeg(leg.id, { amount: e.target.value, quote: null })
                                        }
                                    />
                                    <LegBalanceDisplay
                                        chainId={leg.originChainId}
                                        tokenAddress={leg.originCurrency}
                                        tokenSymbol={leg.originToken?.symbol}
                                        onMax={(maxVal) => {
                                            const isNative = !leg.originCurrency || leg.originCurrency === NATIVE_TOKEN;
                                            const val = isNative
                                                ? Math.max(0, parseFloat(maxVal) - 0.001).toString()
                                                : maxVal;
                                            updateLeg(leg.id, { amount: val, quote: null });
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="leg-arrow">→</div>

                            <div className="leg-side">
                                <ChainSelector
                                    label="④ To Chain"
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
                                    label="Token to Receive"
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
                                    ❌ {leg.quoteError}
                                </span>
                            </div>
                        )}
                        {leg.quote && (
                            <div className="leg-quote leg-quote-success">
                                <span className="leg-quote-label">
                                    ✅ You receive ~{formatUsd(leg.quote.details?.currencyOut?.amountUsd)}
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

                {/* Main Action Button */}
                <button
                    className={`btn btn-lg btn-full trade-action-btn ${btn.style}`}
                    onClick={btn.onClick}
                    disabled={btn.disabled}
                >
                    {anyQuoting && <span className="spinner"></span>}
                    {btn.text}
                </button>

                <div className="fee-info">
                    💰 Platform fee: {(parseInt(APP_FEE_BPS) / 100).toFixed(1)}% on each trade (collected by Relay)
                </div>
            </div>
        </div>
    );
}
