'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, base, arbitrum, optimism, polygon, zkSync, linea, scroll } from 'wagmi/chains';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const config = createConfig({
    chains: [mainnet, base, arbitrum, optimism, polygon, zkSync, linea, scroll],
    transports: {
        [mainnet.id]: http(),
        [base.id]: http(),
        [arbitrum.id]: http(),
        [optimism.id]: http(),
        [polygon.id]: http(),
        [zkSync.id]: http(),
        [linea.id]: http(),
        [scroll.id]: http(),
    },
    ssr: true,
});

export default function WalletProvider({ children }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#6366f1',
                        accentColorForeground: 'white',
                        borderRadius: 'medium',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}
                    modalSize="compact"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
