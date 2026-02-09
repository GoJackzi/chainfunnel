'use client';

import { useState, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import WalletProvider from '@/components/WalletProvider';
import TradeBuilder from '@/components/TradeBuilder';
import ArbScanner from '@/components/ArbScanner';
import TradeDashboard from '@/components/TradeDashboard';
import { APP_FEE_BPS } from '@/lib/relay';

function AppContent() {
  const [trades, setTrades] = useState([]);

  const handleTradeUpdate = useCallback((update) => {
    setTrades((prev) => {
      const existingIdx = prev.findIndex(
        (t) => t.legId === update.legId && t.legIndex === update.legIndex
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...update };
        return updated;
      }
      return [...prev, update];
    });
  }, []);

  const handleSelectOpportunity = useCallback((opp) => {
    const builder = document.querySelector('.trade-builder-col');
    if (builder) {
      builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">ChainFunnel</span>
          <span className="logo-badge">Beta</span>
        </div>
        <div className="header-right">
          <div className="stat-chip">
            <span className="stat-label">Chains</span>
            <span className="stat-value">50+</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">App Fee</span>
            <span className="stat-value green">
              {(parseInt(APP_FEE_BPS) / 100).toFixed(1)}%
            </span>
          </div>
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </header>

      {/* Stats Ribbon */}
      <div className="stats-ribbon">
        <div className="stat-chip">
          <span className="stat-label">Protocol</span>
          <span className="stat-value" style={{ color: 'var(--accent-primary)' }}>
            Relay
          </span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">Median Bridge</span>
          <span className="stat-value green">~3s</span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">Uptime</span>
          <span className="stat-value green">99.9%</span>
        </div>
        <div className="stat-chip">
          <span className="stat-label">Active Trades</span>
          <span className="stat-value">
            {trades.filter((t) => t.status === 'executing').length}
          </span>
        </div>
      </div>

      {/* Welcome Hero */}
      <div className="welcome-hero">
        <div className="welcome-content">
          <h1 className="welcome-title">
            Move tokens across chains in seconds
          </h1>
          <p className="welcome-subtitle">
            Bridge &amp; swap between 50+ blockchains. Select your chains, pick tokens, enter an amount, and execute — all in one place.
          </p>
        </div>
        <div className="welcome-steps">
          <div className="welcome-step">
            <div className="welcome-step-num">1</div>
            <span>Pick chains &amp; tokens</span>
          </div>
          <div className="welcome-step-arrow">→</div>
          <div className="welcome-step">
            <div className="welcome-step-num">2</div>
            <span>Get a quote</span>
          </div>
          <div className="welcome-step-arrow">→</div>
          <div className="welcome-step">
            <div className="welcome-step-num">3</div>
            <span>Execute &amp; done</span>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Grid */}
      <div className="main-grid">
        {/* Left: Arb Scanner */}
        <div className="arb-scanner-col">
          <ArbScanner onSelectOpportunity={handleSelectOpportunity} />
        </div>

        {/* Center: Trade Builder */}
        <div className="trade-builder-col">
          <TradeBuilder onTradeUpdate={handleTradeUpdate} />
        </div>

        {/* Right: Dashboard */}
        <div className="dashboard-col">
          <TradeDashboard trades={trades} />
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '32px 0',
          marginTop: '24px',
          borderTop: '1px solid var(--border-primary)',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        Built on{' '}
        <a
          href="https://relay.link"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
        >
          Relay Protocol
        </a>{' '}
        · Fastest cross-chain settlement · 50+ chains supported
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}
