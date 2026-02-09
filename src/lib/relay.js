// ============================================
// Relay API Wrapper
// Core functions to interact with Relay Protocol
// ============================================

const RELAY_API_BASE = 'https://api.relay.link';

// ---- FEE CONFIG ----
// Set your wallet address here to collect app fees
export const APP_FEE_RECIPIENT = '0x34d4ECD77D6378EbddA1C62A38881E4587109181'; // TODO: Replace with your wallet
export const APP_FEE_BPS = '30'; // 0.3% fee

export function getAppFees() {
    if (APP_FEE_RECIPIENT === '0x0000000000000000000000000000000000000000') return undefined;
    return [
        {
            recipient: APP_FEE_RECIPIENT,
            fee: APP_FEE_BPS,
        },
    ];
}

// ---- CHAINS ----
export async function getChains() {
    const res = await fetch(`${RELAY_API_BASE}/chains`);
    if (!res.ok) throw new Error(`Failed to fetch chains: ${res.status}`);
    const data = await res.json();
    return data.chains || data;
}

// ---- CURRENCIES ----
export async function getCurrencies(chainId, options = {}) {
    const body = {
        chainIds: [Number(chainId)],
        defaultList: true,
    };
    if (options.term) body.term = options.term;
    if (options.limit) body.limit = options.limit;
    if (options.verified !== undefined) body.verified = options.verified;
    if (options.useExternalSearch) body.useExternalSearch = true;

    const res = await fetch(`${RELAY_API_BASE}/currencies/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to fetch currencies: ${res.status}`);
    const data = await res.json();

    // Response is a nested array [[token1, token2, ...]]
    // Flatten it to a single array
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
        return data.flat();
    }
    if (Array.isArray(data)) return data;
    return [];
}

// ---- TOKEN PRICE ----
export async function getTokenPrice(chainId, address) {
    const currency = `${chainId}:${address}`;
    const res = await fetch(`${RELAY_API_BASE}/token-price?currency=${currency}`);
    if (!res.ok) throw new Error(`Failed to fetch token price: ${res.status}`);
    return res.json();
}

// ---- QUOTE ----
export async function getQuote({
    user,
    originChainId,
    originCurrency,
    destinationChainId,
    destinationCurrency,
    amount,
    tradeType = 'EXACT_INPUT',
    recipient,
}) {
    const body = {
        user: user || '0x0000000000000000000000000000000000000000',
        originChainId,
        originCurrency,
        destinationChainId,
        destinationCurrency,
        amount,
        tradeType,
    };

    if (recipient) body.recipient = recipient;

    const appFees = getAppFees();
    if (appFees) body.appFees = appFees;

    const res = await fetch(`${RELAY_API_BASE}/quote/v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to get quote: ${res.status}`);
    }
    return res.json();
}

// ---- STATUS ----
export async function getStatus(requestId) {
    const res = await fetch(`${RELAY_API_BASE}/intents/status/v3?requestId=${requestId}`);
    if (!res.ok) throw new Error(`Failed to get status: ${res.status}`);
    return res.json();
}

// ---- REQUESTS ----
export async function getRequests(user) {
    const res = await fetch(`${RELAY_API_BASE}/requests?user=${user}`);
    if (!res.ok) throw new Error(`Failed to get requests: ${res.status}`);
    return res.json();
}

// ---- HELPERS ----
export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

export function formatAmount(amount, decimals) {
    if (!amount) return '0';
    const num = Number(amount) / 10 ** decimals;
    if (num < 0.001) return '<0.001';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(3);
    if (num < 1000000) return (num / 1000).toFixed(2) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
}

export function formatUsd(amountUsd) {
    if (!amountUsd) return '$0.00';
    const num = parseFloat(amountUsd);
    if (num < 0.01) return '<$0.01';
    return '$' + num.toFixed(2);
}

// Popular chains for scanning
export const POPULAR_CHAINS = [
    { id: 1, name: 'Ethereum', icon: '⟠' },
    { id: 8453, name: 'Base', icon: '🔵' },
    { id: 42161, name: 'Arbitrum', icon: '🔷' },
    { id: 10, name: 'Optimism', icon: '🔴' },
    { id: 137, name: 'Polygon', icon: '💜' },
    { id: 324, name: 'zkSync', icon: '🔲' },
    { id: 59144, name: 'Linea', icon: '🟢' },
    { id: 534352, name: 'Scroll', icon: '📜' },
];

// Popular tokens to scan for arb
export const SCAN_TOKENS = [
    { symbol: 'ETH', address: NATIVE_TOKEN, decimals: 18, icon: '⟠' },
    {
        symbol: 'USDC', decimals: 6, icon: '💲',
        addresses: {
            1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            10: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
            137: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        }
    },
    {
        symbol: 'USDT', decimals: 6, icon: '💵',
        addresses: {
            1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            42161: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
            10: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
            137: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        }
    },
];
