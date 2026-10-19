import React, { useState } from 'react';
import { ASSET_CONFIGS } from '../data/mockData';
import { AssetSymbolKey } from '../types';
import { calculatePositionSize } from '../utils/quant_engine';
import { Shield, DollarSign, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const RiskCalculator: React.FC = () => {
  const [equity, setEquity] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(0.25); // 0.25% default
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbolKey>('XAUUSD');
  const [entryPrice, setEntryPrice] = useState<number>(2720.0);
  const [stopLossPrice, setStopLossPrice] = useState<number>(2710.0);
  const [dailyDrawdownPercent, setDailyDrawdownPercent] = useState<number>(0.2);

  const cfg = ASSET_CONFIGS[selectedAsset];

  const accountState = {
    balance: equity,
    equity: equity * (1 - dailyDrawdownPercent / 100),
    free_margin: equity * 0.95,
    daily_start_equity: equity,
    open_positions_count: 1,
    emergency_halt: false,
  };

  const spec = {
    symbol: cfg.brokerSymbolDefault,
    contract_size: cfg.contractSize,
    pip_size: cfg.pipSize,
    volume_min: cfg.volumeMin,
    volume_max: cfg.volumeMax,
    volume_step: cfg.volumeStep,
    digits: cfg.digits,
    magic: cfg.magicNumber,
  };

  const sizingResult = calculatePositionSize(
    accountState,
    spec,
    entryPrice,
    stopLossPrice,
    riskPercent / 100,
    0.01 // 1.0% daily limit
  );

  const monetaryRiskBudget = accountState.equity * (riskPercent / 100);
  const priceDistance = Math.abs(entryPrice - stopLossPrice);
  const lossPerLot = priceDistance * cfg.contractSize;
  const estimatedMargin = (sizingResult.volume * cfg.contractSize * entryPrice) / 50; // 1:50 leverage proxy

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            Institutional Risk Management & Exact Margin Sizer
          </h3>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
          The risk engine operates independently from predictions. It enforces strict 0.25% fractional equity risk, rounds down to broker volume steps, verifies free margin, and activates a hard circuit breaker at 1.0% daily loss.
        </p>

        {/* Input Parameters Grid */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Equity & Risk Budget */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div>
              <label className="text-slate-400 block text-[11px] mb-1">Account Equity ($)</label>
              <input
                type="number"
                value={equity}
                onChange={(e) => setEquity(parseFloat(e.target.value) || 1000)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-bold text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Risk per Trade (% of Equity)</span>
                <span className="text-emerald-400 font-bold">{riskPercent}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.05"
                value={riskPercent}
                onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Suggested Baseline: 0.25% ($
                {((equity * riskPercent) / 100).toFixed(2)})
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Simulated Today Drawdown (%)</span>
                <span
                  className={
                    dailyDrawdownPercent >= 1.0 ? 'text-rose-400 font-bold' : 'text-slate-300'
                  }
                >
                  {dailyDrawdownPercent.toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={dailyDrawdownPercent}
                onChange={(e) => setDailyDrawdownPercent(parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                1.0% triggers emergency trading halt
              </span>
            </div>
          </div>

          {/* Asset & Price Levels */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div>
              <label className="text-slate-400 block text-[11px] mb-1">Target Asset</label>
              <select
                value={selectedAsset}
                onChange={(e) => {
                  const a = e.target.value as AssetSymbolKey;
                  setSelectedAsset(a);
                  if (a === 'XAUUSD') {
                    setEntryPrice(2720);
                    setStopLossPrice(2710);
                  } else if (a === 'BTCUSD') {
                    setEntryPrice(68000);
                    setStopLossPrice(67400);
                  } else {
                    setEntryPrice(20450);
                    setStopLossPrice(20400);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-bold text-sm focus:outline-none"
              >
                <option value="XAUUSD">Gold (XAUUSD - Contract 100 oz)</option>
                <option value="BTCUSD">Bitcoin (BTCUSD - Contract 1 BTC)</option>
                <option value="NASDAQ">NASDAQ CFD (US100 - Contract 1 unit)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block text-[11px] mb-1">Planned Entry Price ($)</label>
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block text-[11px] mb-1">Stop-Loss Price ($)</label>
              <input
                type="number"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Sizing Calculation Output */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-slate-400 uppercase text-[10px] mb-1 font-bold">
                Calculated Sizing Result
              </div>
              {sizingResult.valid ? (
                <div className="bg-emerald-950/30 border border-emerald-500/50 p-3 rounded-lg text-emerald-300">
                  <div className="text-xs font-bold uppercase flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Order Size Approved</span>
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {sizingResult.volume.toFixed(2)}{' '}
                    <span className="text-sm text-emerald-400">Lots</span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1">
                    Monetary Risk: <b>${sizingResult.monetaryRisk.toFixed(2)}</b> (
                    {((sizingResult.monetaryRisk / accountState.equity) * 100).toFixed(2)}% of equity)
                  </div>
                </div>
              ) : (
                <div className="bg-rose-950/30 border border-rose-500/50 p-3 rounded-lg text-rose-300">
                  <div className="text-xs font-bold uppercase flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Order Rejected</span>
                  </div>
                  <p className="text-xs mt-1 text-slate-200">{sizingResult.reason}</p>
                </div>
              )}
            </div>

            {/* Micro Breakdown */}
            <div className="space-y-1.5 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <div className="flex justify-between">
                <span>Stop Distance:</span>
                <span className="text-white font-semibold">${priceDistance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Loss per 1.0 Lot:</span>
                <span className="text-white font-semibold">${lossPerLot.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Required Margin (est):</span>
                <span className="text-white font-semibold">${estimatedMargin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Broker Volume Step:</span>
                <span className="text-cyan-400 font-semibold">{cfg.volumeStep} lots</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
