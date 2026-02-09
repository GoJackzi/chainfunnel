// ============================================
// Multi-Leg Execution Engine
// Handles sequential execution of trade legs
// ============================================

import { getQuote, getStatus } from './relay';

// Execute a single leg
export async function executeLeg(leg, walletClient, onStatusUpdate) {
    onStatusUpdate?.({ legId: leg.id, status: 'quoting', message: 'Getting quote...' });

    // 1. Get fresh quote
    const quote = await getQuote({
        user: walletClient.account.address,
        originChainId: leg.originChainId,
        originCurrency: leg.originCurrency,
        destinationChainId: leg.destinationChainId,
        destinationCurrency: leg.destinationCurrency,
        amount: leg.amount,
        recipient: walletClient.account.address,
    });

    onStatusUpdate?.({ legId: leg.id, status: 'signing', message: 'Confirm in wallet...' });

    // 2. Execute steps from quote
    let requestId = null;
    for (const step of quote.steps) {
        const item = step.items[0];
        requestId = step.requestId;

        if (step.kind === 'transaction') {
            // Send the transaction
            const hash = await walletClient.sendTransaction({
                to: item.data.to,
                data: item.data.data,
                value: BigInt(item.data.value || '0'),
                chainId: item.data.chainId,
            });

            onStatusUpdate?.({
                legId: leg.id,
                status: 'executing',
                message: 'Transaction submitted',
                txHash: hash,
                requestId,
            });
        } else if (step.kind === 'signature') {
            // Sign the message
            const signature = await walletClient.signMessage({
                message: item.data.message,
            });

            onStatusUpdate?.({
                legId: leg.id,
                status: 'executing',
                message: 'Signature submitted',
                requestId,
            });
        }
    }

    // 3. Poll for completion
    if (requestId) {
        const result = await pollStatus(requestId, (status) => {
            onStatusUpdate?.({
                legId: leg.id,
                status: 'executing',
                message: `Status: ${status}`,
                requestId,
            });
        });
        return result;
    }

    return { status: 'complete', quote };
}

// Poll status until complete or failed
async function pollStatus(requestId, onUpdate, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(3000);
        try {
            const status = await getStatus(requestId);
            const currentStatus = status?.status || status?.state;

            onUpdate?.(currentStatus);

            if (currentStatus === 'success' || currentStatus === 'complete' || currentStatus === 'filled') {
                return { status: 'complete', data: status };
            }
            if (currentStatus === 'failed' || currentStatus === 'refunded') {
                return { status: 'failed', data: status };
            }
        } catch (err) {
            console.error('Status poll error:', err);
        }
    }
    return { status: 'timeout' };
}

// Execute multiple legs sequentially
export async function executeMultiLeg(legs, walletClient, onStatusUpdate) {
    const results = [];

    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        onStatusUpdate?.({
            legIndex: i,
            totalLegs: legs.length,
            legId: leg.id,
            status: 'starting',
            message: `Executing leg ${i + 1} of ${legs.length}`,
        });

        try {
            const result = await executeLeg(leg, walletClient, (update) => {
                onStatusUpdate?.({ ...update, legIndex: i, totalLegs: legs.length });
            });

            results.push({ leg, result });

            if (result.status === 'failed') {
                onStatusUpdate?.({
                    legIndex: i,
                    totalLegs: legs.length,
                    legId: leg.id,
                    status: 'failed',
                    message: `Leg ${i + 1} failed — stopping execution`,
                });
                break;
            }

            onStatusUpdate?.({
                legIndex: i,
                totalLegs: legs.length,
                legId: leg.id,
                status: 'complete',
                message: `Leg ${i + 1} complete`,
            });
        } catch (err) {
            results.push({ leg, result: { status: 'error', error: err.message } });
            onStatusUpdate?.({
                legIndex: i,
                totalLegs: legs.length,
                legId: leg.id,
                status: 'error',
                message: err.message,
            });
            break;
        }
    }

    return results;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
