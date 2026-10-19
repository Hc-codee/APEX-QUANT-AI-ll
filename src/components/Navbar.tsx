import React, { useState } from 'react';
import {
  ShieldAlert,
  Activity,
  Server,
  Lock,
  Unlock,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { TradingMode, WorkerStatusJson } from '../types';

interface NavbarProps {
  mode: TradingMode;
  onModeChange: (newMode: TradingMode) => void;
  status: WorkerStatusJson;
  onEmergencyHaltToggle: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  onModeChange,
  status,
  onEmergencyHaltToggle,
  activeTab,
  onTabChange,
}) => {
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);
  const [liveConfirmAcknowledged, setLiveConfirmAcknowledged] = useState(false);

  const tabs = [
    { id: 'cockpit', label: 'Trading Cockpit' },
    { id: 'assets', label: 'Asset Desks' },
    { id: 'features', label: 'Quant & Regimes' },
    { id: 'ml', label: 'ML & Calibration' },
    { id: 'backtest', label: 'Walk-Forward Engine' },
    { id: 'risk', label: 'Risk & Margin' },
    { id: 'wine', label: 'Wine/MT5 Bridge' },
    { id: 'audit', label: 'Audit & Docs' },
  ];

  const handleModeClick = (targetMode: TradingMode) => {
    if (targetMode === 'LIVE') {
      setShowLiveConfirmModal(true);
    } else {
      onModeChange(targetMode);
    }
  };

  const confirmLiveMode = () => {
    if (liveConfirmAcknowledged) {
      onModeChange('LIVE');
      setShowLiveConfirmModal(false);
      setLiveConfirmAcknowledged(false);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-lg">
      {/* Top Banner / System Telemetry */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 text-xs">
        {/* Brand & Status */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center font-bold text-slate-950 shadow-md">
              HN
            </div>
            <div>
              <div className="flex items-center space-x-1.5 font-bold tracking-wider text-slate-100 text-sm">
                <span>HC-NEXUS</span>
                <span className="text-emerald-400">QUANT AI</span>
                <span className="text-[10px] bg-slate-800 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                  V1.0
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Wine MT5 Quantitative System</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-2 pl-3 border-l border-slate-800">
            <div className="flex items-center space-x-1.5 bg-slate-800/70 px-2.5 py-1 rounded border border-slate-700/60">
              <span className={`w-2 h-2 rounded-full ${status.connection_status === 'ONLINE' || status.connection_status === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="font-mono text-slate-300">IPC: MQL5/Files/hc_nexus</span>
            </div>
            <div className="flex items-center space-x-1 bg-slate-800/70 px-2 py-1 rounded text-slate-400 font-mono">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ping: 14ms</span>
            </div>
          </div>
        </div>

        {/* Account Strip Metrics */}
        <div className="flex items-center space-x-3 md:space-x-5 font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Equity</span>
            <span className="font-bold text-slate-100">${status.account_equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Balance</span>
            <span className="text-slate-300">${status.account_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Day P&L</span>
            <span className={`font-semibold ${status.realized_pnl_today >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {status.realized_pnl_today >= 0 ? '+' : ''}${status.realized_pnl_today.toFixed(2)}
            </span>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Day DD: {status.daily_drawdown_pct.toFixed(2)}%</span>
              <span className="text-slate-400 ml-1">/ Max {status.daily_loss_limit_pct}%</span>
            </div>
            <div className="w-20 bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700">
              <div
                className={`h-full ${status.daily_drawdown_pct > 0.8 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min((status.daily_drawdown_pct / status.daily_loss_limit_pct) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Mode Selector & Emergency Halt */}
        <div className="flex items-center space-x-2">
          {/* Mode Pill Switcher */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center space-x-1">
            {(['BACKTEST', 'PAPER', 'LIVE'] as TradingMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeClick(m)}
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors ${
                  mode === m
                    ? m === 'LIVE'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : m === 'PAPER'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Emergency Halt Button */}
          <button
            onClick={onEmergencyHaltToggle}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              status.emergency_halt
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-bounce'
                : 'bg-rose-600/20 border border-rose-500/50 hover:bg-rose-600 hover:text-white text-rose-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{status.emergency_halt ? 'HALT ACTIVE (RESET)' : 'EMERGENCY HALT'}</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="px-4 flex overflow-x-auto scrollbar-none space-x-1 py-1.5 text-sm font-medium bg-slate-950/70">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap text-xs font-semibold ${
              activeTab === tab.id
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Live Mode Confirmation Dialog Modal */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
              <h3 className="text-lg font-bold text-white">Engage Live Capital Trading Mode</h3>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              You are about to switch from <span className="text-cyan-400 font-mono">PAPER</span> simulation to <span className="text-rose-400 font-bold font-mono">LIVE MT5 EXECUTION</span>. Real broker orders will be sent via Wine/MQL5 IPC with real financial risk.
            </p>
            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs text-slate-400 space-y-1 mb-4 font-mono">
              <div>• Maximum risk per trade: <span className="text-emerald-400">0.25% equity</span></div>
              <div>• Daily hard loss limit: <span className="text-rose-400">1.0% equity</span></div>
              <div>• Max concurrent open positions: <span className="text-slate-200">3 total, 1 per asset</span></div>
              <div>• Strict volume step normalization enforced.</div>
            </div>
            <label className="flex items-center space-x-2 text-xs text-slate-300 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={liveConfirmAcknowledged}
                onChange={(e) => setLiveConfirmAcknowledged(e.target.checked)}
                className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <span>I confirm broker connectivity is verified and authorize live trade execution.</span>
            </label>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowLiveConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel (Stay in Paper)
              </button>
              <button
                disabled={!liveConfirmAcknowledged}
                onClick={confirmLiveMode}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-md"
              >
                Engage LIVE Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
