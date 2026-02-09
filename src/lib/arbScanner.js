// ============================================
// Arbitrage Scanner
// Detects price spreads across chains
// ============================================

import { getQuote, POPULAR_CHAINS, SCAN_TOKENS, NATIVE_TOKEN, formatUsd, APP_FEE_BPS } from './relay';

const SCAN_AMOUNT_ETH = '100000000000000000'; // 0.1 ETH
const SCAN_AMOUNT_STABLE = '100000000'; // 100 USDC/USDT

// Scan for arbitrage opportunities across chains
export async function scanArbitrage(onResult) {
    const opportunities = [];
    const pairs = generateScanPairs();

    // Process in batches to avoid rate limiting
    const batchSize = 4;
    for (let i = 0; i < pairs.length; i += batchSize) {
        const batch = pairs.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async (pair) => {
                try {
                    const quote = await getQuote({
                        user: '0x0000000000000000000000000000000000000000',
                        originChainId: pair.originChainId,
                        originCurrency: pair.originCurrency,
                        destinationChainId: pair.destinationChainId,
                        destinationCurrency: pair.destinationCurrency,
                        amount: pair.amount,
                    });

                    if (quote?.details) {
                        const inputUsd = parseFloat(quote.details.currencyIn?.amountUsd || '0');
                        const outputUsd = parseFloat(quote.details.currencyOut?.amountUsd || '0');
                        const totalFeeUsd = parseFloat(quote.fees?.relayer?.amountUsd || '0');

                        if (inputUsd > 0 && outputUsd > 0) {
                            const spreadPercent = ((outputUsd - inputUsd) / inputUsd) * 100;
                            const netProfitUsd = outputUsd - inputUsd - totalFeeUsd;
                            const netProfitPercent = (netProfitUsd / inputUsd) * 100;

                            return {
                                ...pair,
                                inputUsd,
                                outputUsd,
                                totalFeeUsd,
                                spreadPercent,
                                netProfitUsd,
                                netProfitPercent,
                                rate: quote.details.rate,
                                timeEstimate: quote.details.timeEstimate,
                            };
                        }
                    }
                    return null;
                } catch (err) {
                    return null;
                }
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                opportunities.push(result.value);
                onResult?.(result.value);
            }
        }

        // Small delay between batches
        if (i + batchSize < pairs.length) {
            await new Promise((r) => setTimeout(r, 500));
        }
    }

    // Sort by net profit descending
    opportunities.sort((a, b) => b.netProfitPercent - a.netProfitPercent);
    return opportunities;
}

// Generate token pairs to scan across chains
function generateScanPairs() {
    const pairs = [];

    // ETH across chains
    const ethChains = [1, 8453, 42161, 10];
    for (let i = 0; i < ethChains.length; i++) {
        for (let j = i + 1; j < ethChains.length; j++) {
            pairs.push({
                token: 'ETH',
                tokenIcon: '⟠',
                originChainId: ethChains[i],
                originChainName: getChainName(ethChains[i]),
                originCurrency: NATIVE_TOKEN,
                destinationChainId: ethChains[j],
                destinationChainName: getChainName(ethChains[j]),
                destinationCurrency: NATIVE_TOKEN,
                amount: SCAN_AMOUNT_ETH,
                decimals: 18,
            });
        }
    }

    // USDC across chains
    const usdcToken = SCAN_TOKENS.find((t) => t.symbol === 'USDC');
    if (usdcToken) {
        const usdcChains = Object.keys(usdcToken.addresses).map(Number);
        for (let i = 0; i < usdcChains.length; i++) {
            for (let j = i + 1; j < usdcChains.length; j++) {
                pairs.push({
                    token: 'USDC',
                    tokenIcon: '💲',
                    originChainId: usdcChains[i],
                    originChainName: getChainName(usdcChains[i]),
                    originCurrency: usdcToken.addresses[usdcChains[i]],
                    destinationChainId: usdcChains[j],
                    destinationChainName: getChainName(usdcChains[j]),
                    destinationCurrency: usdcToken.addresses[usdcChains[j]],
                    amount: SCAN_AMOUNT_STABLE,
                    decimals: 6,
                });
            }
        }
    }

    // USDT across chains
    const usdtToken = SCAN_TOKENS.find((t) => t.symbol === 'USDT');
    if (usdtToken) {
        const usdtChains = Object.keys(usdtToken.addresses).map(Number);
        for (let i = 0; i < usdtChains.length; i++) {
            for (let j = i + 1; j < usdtChains.length; j++) {
                pairs.push({
                    token: 'USDT',
                    tokenIcon: '💵',
                    originChainId: usdtChains[i],
                    originChainName: getChainName(usdtChains[i]),
                    originCurrency: usdtToken.addresses[usdtChains[i]],
                    destinationChainId: usdtChains[j],
                    destinationChainName: getChainName(usdtChains[j]),
                    destinationCurrency: usdtToken.addresses[usdtChains[j]],
                    amount: SCAN_AMOUNT_STABLE,
                    decimals: 6,
                });
            }
        }
    }

    return pairs;
}

function getChainName(chainId) {
    const chain = POPULAR_CHAINS.find((c) => c.id === chainId);
    return chain?.name || `Chain ${chainId}`;
}

export function getChainIcon(chainId) {
    const chain = POPULAR_CHAINS.find((c) => c.id === chainId);
    return chain?.icon || '🔗';
}
