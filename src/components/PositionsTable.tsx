import React from 'react';
import { Position } from '../types';
import { Check, X, Shield, RefreshCw, AlertOctagon } from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  onClosePosition: (ticket: number) => void;
  onCloseAll: () => void;
  onToggleTrailing: (ticket: number) => void;
  onToggleBreakeven: (ticket: number) => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  onClosePosition,
  onCloseAll,
  onToggleTrailing,
  onToggleBreakeven,
}) => {
  const totalProfit = positions.reduce((acc, p) => acc + p.profit, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">
            Active MT5 Managed Positions ({positions.length})
          </h3>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="text-slate-300">
            Total Floating:{' '}
            <span
              className={`font-bold ${
                totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
            </span>
          </div>

          {positions.length > 0 && (
            <button
              onClick={onCloseAll}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/50 transition-colors text-[11px] font-bold"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Close All</span>
            </button>
          )}
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="py-8 text-center text-slate-500 font-mono text-xs">
          No open positions. Risk budget 100% available. Standing by for pipeline signal.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Ticket</th>
                <th className="py-2 px-2">Symbol</th>
                <th className="py-2 px-2">Side</th>
                <th className="py-2 px-2">Lots</th>
                <th className="py-2 px-2">Open</th>
                <th className="py-2 px-2">Current</th>
                <th className="py-2 px-2">SL / TP</th>
                <th className="py-2 px-2">PnL</th>
                <th className="py-2 px-2">Protection</th>
                <th className="py-2 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {positions.map((pos) => {
                const isBuy = pos.action === 'BUY';
                return (
                  <tr key={pos.ticket} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-400">
                      #{pos.ticket}
                      <span className="block text-[9px] text-slate-400">
                        Magic {pos.magic}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-bold text-white">{pos.symbol}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isBuy
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}
                      >
                        {pos.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-200">
                      {pos.volume.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">${pos.openPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-2 font-bold text-white">
                      ${pos.currentPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-[11px]">
                      <span className="text-rose-400 block">SL: ${pos.sl.toFixed(2)}</span>
                      <span className="text-emerald-400 block">TP: ${pos.tp.toFixed(2)}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`font-bold block ${
                          pos.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos.profit >= 0 ? '+' : ''}${pos.profit.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({pos.profitPips >= 0 ? '+' : ''}
                        {pos.profitPips} pips)
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => onToggleBreakeven(pos.ticket)}
                          title="Break-even lock"
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                            pos.breakevenActive
                              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          BE {pos.breakevenActive ? '✓' : ''}
                        </button>
                        <button
                          onClick={() => onToggleTrailing(pos.ticket)}
                          title="ATR Trailing Stop"
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                            pos.trailingActive
                              ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          Trail {pos.trailingActive ? '✓' : ''}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <button
                        onClick={() => onClosePosition(pos.ticket)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors text-[10px] font-bold"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
