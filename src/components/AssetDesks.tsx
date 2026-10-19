import React, { useState } from 'react';
import { ASSET_CONFIGS, AssetConfig } from '../data/mockData';
import { AssetSymbolKey } from '../types';
import { Clock, Shield, Coins, Activity, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

interface AssetDesksProps {
  selectedAsset: AssetSymbolKey;
  onSelectAsset: (asset: AssetSymbolKey) => void;
}

export const AssetDesks: React.FC<AssetDesksProps> = ({ selectedAsset, onSelectAsset }) => {
  const [brokerCustomSymbols, setBrokerCustomSymbols] = useState<Record<AssetSymbolKey, string>>({
    XAUUSD: 'XAUUSD',
    BTCUSD: 'BTCUSD',
    NASDAQ: 'US100',
  });

  const handleCustomSymbolChange = (key: AssetSymbolKey, val: string) => {
    setBrokerCustomSymbols((prev) => ({ ...prev, [key]: val }));
  };

  const assetList: AssetSymbolKey[] = ['XAUUSD', 'BTCUSD', 'NASDAQ'];

  return (
    <div className="space-y-6">
      {/* Asset Switcher Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {assetList.map((key) => {
          const cfg = ASSET_CONFIGS[key];
          const isSelected = selectedAsset === key;
          return (
            <div
              key={key}
              onClick={() => onSelectAsset(key)}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 border-emerald-500 shadow-lg ring-1 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-base">{cfg.name}</span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    isSelected ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {cfg.brokerSymbolDefault}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{cfg.sessionDescription}</p>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                <span>Spread Cap: {cfg.maxSpreadPips} pips</span>
                <span>Lot Step: {cfg.volumeStep}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Asset Deep-Dive Specification & Broker Resolver */}
      {(() => {
        const cfg = ASSET_CONFIGS[selectedAsset];
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>{cfg.name} Quantitative Desk</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                    Magic #{cfg.magicNumber}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Instrument specifications, broker alias resolver, and execution rules
                </p>
              </div>

              {/* Broker Symbol Mapping Input */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center space-x-3 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">Your Broker's Actual Symbol:</span>
                  <input
                    type="text"
                    value={brokerCustomSymbols[selectedAsset]}
                    onChange={(e) => handleCustomSymbolChange(selectedAsset, e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold w-28 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="text-[10px] text-slate-400 max-w-[200px]">
                  Detected aliases: {cfg.aliases.join(', ')}
                </div>
              </div>
            </div>

            {/* Contract Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Contract Size</span>
                <span className="font-bold text-slate-200 text-sm">{cfg.contractSize}</span>
                <span className="text-[10px] text-slate-400 block">units/lot</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Pip/Point Size</span>
                <span className="font-bold text-slate-200 text-sm">{cfg.pipSize}</span>
                <span className="text-[10px] text-slate-400 block">{cfg.digits} decimals</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Volume Step</span>
                <span className="font-bold text-emerald-400 text-sm">{cfg.volumeStep}</span>
                <span className="text-[10px] text-slate-400 block">Min: {cfg.volumeMin}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Max Volume</span>
                <span className="font-bold text-slate-200 text-sm">{cfg.volumeMax}</span>
                <span className="text-[10px] text-slate-400 block">lots cap</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Spread Filter</span>
                <span className="font-bold text-amber-400 text-sm">≤ {cfg.maxSpreadPips}</span>
                <span className="text-[10px] text-slate-400 block">pips limit</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Trading Window</span>
                <span className="font-bold text-cyan-400 text-sm">Active</span>
                <span className="text-[10px] text-slate-400 block truncate">{cfg.tradingHours}</span>
              </div>
            </div>

            {/* Asset-Specific Risk Filters & Guardrails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold uppercase text-[11px]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Session & Liquidity Guardrails</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {cfg.sessionDescription}
                </p>
                <div className="space-y-1.5 text-slate-400 pt-1 text-[11px]">
                  <div>• Rollover filter: Rejects signals during daily swap rollover window.</div>
                  <div>• Weekend filter: Shuts down CFD exposure before Friday market settlement.</div>
                  <div>• Intraday whipsaw: Filters out noise during market open auctions.</div>
                </div>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold uppercase text-[11px]">
                  <Shield className="w-4 h-4" />
                  <span>Dynamic Volatility Stops (ATR-Adaptive)</span>
                </div>
                <div className="space-y-2 text-slate-300 text-[11px]">
                  <div>
                    <span className="text-slate-400">Stop-Loss: </span>
                    <b className="text-rose-400">2.0 × ATR(14)</b> (Never closer than broker minimum stop level)
                  </div>
                  <div>
                    <span className="text-slate-400">Take-Profit: </span>
                    <b className="text-emerald-400">3.0 × ATR(14)</b> (Guaranteed 1:1.5 Risk-to-Reward ratio minimum)
                  </div>
                  <div>
                    <span className="text-slate-400">Break-Even Trigger: </span>
                    <b className="text-cyan-400">1.5 × ATR</b> favorable excursion moves SL to Entry + 0.1 ATR.
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
