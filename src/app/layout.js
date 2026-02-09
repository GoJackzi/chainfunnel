import './globals.css';

export const metadata = {
  title: 'ChainFunnel — Cross-Chain Trade Aggregation Terminal',
  description:
    'Multi-leg batch trade execution across 50+ chains with built-in arbitrage detection. Powered by Relay Protocol.',
  openGraph: {
    title: 'ChainFunnel — Cross-Chain Trade Aggregation Terminal',
    description:
      'Multi-leg batch trade execution across 50+ chains with built-in arbitrage detection.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChainFunnel — Cross-Chain Trade Aggregation Terminal',
    description: 'Multi-leg batch trade execution across 50+ chains with built-in arbitrage detection.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0b0f" />
      </head>
      <body>{children}</body>
    </html>
  );
}
