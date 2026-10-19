import React, { useState } from 'react';
import { Sliders, Activity, TrendingUp, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

export const FeaturesRegimesLab: React.FC = () => {
  // Live demo interactive feature values for Gold
  const [features, setFeatures] = useState({
    ret_1: 0.0018,
    ret_3: 0.0042,
    ret_5: 0.0076,
    ret_12: 0.0115,
    atr: 4.85,
    natr: 0.00178,
    realized_vol: 0.0084,
    rsi: 61.4,
    adx: 29.8,
    dist_sma20: 0.0038,
    dist_ema50: 0.0062,
    body_ratio: 0.72,
    upper_wick_ratio: 0.16,
    lower_wick_ratio: 0.12,
    donchian_pos: 0.88,
    hour_utc: 15.5,
  });

  const regimes = [
    {
      id: 'TRENDING_BULL',
      name: 'Trending Bullish',
      tradeable: true,
      condition: 'ADX >= 25, Price > SMA20 & EMA50',
      action: 'Trend-following Long entries authorized',
      active: features.adx >= 25 && features.dist_sma20 > 0,
    },
    {
      id: 'TRENDING_BEAR',
      name: 'Trending Bearish',
      tradeable: true,
      condition: 'ADX >= 25, Price < SMA20 & EMA50',
      action: 'Trend-following Short entries authorized',
      active: features.adx >= 25 && features.dist_sma20 < 0,
    },
    {
      id: 'VOLATILITY_EXPANSION',
      name: 'Volatility Expansion',
      tradeable: true,
      condition: 'Donchian pos > 0.95 or < 0.05, ADX > 22',
      action: 'Breakout momentum entries authorized',
      active: features.donchian_pos > 0.95 || features.donchian_pos < 0.05,
    },
    {
      id: 'RANGING_LOW_VOL',
      name: 'Ranging / Low Volatility',
      tradeable: true,
      condition: 'ADX < 25, NATR < 0.012',
      action: 'Mean-reversion authorized with tightened stops',
      active: features.adx < 25 && features.natr < 0.012,
    },
    {
      id: 'RANGING_HIGH_VOL',
      name: 'Ranging / High Volatility',
      tradeable: false,
      condition: 'ADX < 25, NATR >= 0.012',
      action: 'NO TRADE: Unpredictable chop swallows spread/slippage',
      active: features.adx < 25 && features.natr >= 0.012,
    },
    {
      id: 'ABNORMAL_UNRELIABLE',
      name: 'Abnormal / Unreliable Feed',
      tradeable: false,
      condition: 'Realized Vol > 0.04 or Spread > Max Cap',
      action: 'HALT: Outside validated distribution',
      active: features.realized_vol > 0.04,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
          <Sliders className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            Quantitative Feature Engineering & Market Regime Lab
          </h3>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
          Zero-leakage point-in-time quantitative transformation pipeline. All indicators are calculated strictly from completed candle bars (t-1) before any trade inference.
        </p>

        {/* Live Extracted Features Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 font-mono text-xs">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">RSI (14)</span>
            <span className="text-emerald-400 font-bold text-sm">{features.rsi}</span>
            <span className="text-[10px] text-slate-400 block">Momentum Bullish</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">ADX Trend (14)</span>
            <span className="text-cyan-400 font-bold text-sm">{features.adx}</span>
            <span className="text-[10px] text-slate-400 block">Strong Trend (&gt;25)</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">ATR Volatility</span>
            <span className="text-amber-400 font-bold text-sm">${features.atr.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400 block">NATR: {(features.natr * 100).toFixed(3)}%</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Donchian Pos</span>
            <span className="text-purple-400 font-bold text-sm">{(features.donchian_pos * 100).toFixed(0)}%</span>
            <span className="text-[10px] text-slate-400 block">Near 20-bar High</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">SMA20 Distance</span>
            <span className="text-slate-200 font-bold text-sm">+{(features.dist_sma20 * 100).toFixed(2)}%</span>
            <span className="text-[10px] text-slate-400 block">Above Moving Avg</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Bar Body Ratio</span>
            <span className="text-slate-200 font-bold text-sm">{(features.body_ratio * 100).toFixed(0)}%</span>
            <span className="text-[10px] text-slate-400 block">Decisive Candle</span>
          </div>
        </div>
      </div>

      {/* Market Regimes Evaluation Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Regime Classifier State Machine</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {regimes.map((regime) => (
            <div
              key={regime.id}
              className={`p-3.5 rounded-xl border transition-all ${
                regime.active
                  ? regime.tradeable
                    ? 'bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-rose-950/30 border-rose-500 shadow-md ring-1 ring-rose-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white text-xs font-mono">{regime.name}</span>
                {regime.active && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      regime.tradeable
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {regime.tradeable ? 'ACTIVE (TRADE)' : 'ACTIVE (HALT)'}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mb-2">
                <b>Trigger:</b> {regime.condition}
              </div>
              <div className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded border border-slate-800/80">
                {regime.action}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
