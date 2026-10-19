import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Brain,
  Sliders,
  ShieldCheck,
  Zap,
  Info,
} from 'lucide-react';
import { PipelineStep, SignalOutcome } from '../types';

interface PipelineViewerProps {
  outcome: SignalOutcome;
  onExecuteManual?: () => void;
}

export const PipelineViewer: React.FC<PipelineViewerProps> = ({ outcome, onExecuteManual }) => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const getStepIcon = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case 2:
        return <Info className="w-4 h-4 text-blue-400" />;
      case 3:
        return <TrendingUp className="w-4 h-4 text-amber-400" />;
      case 4:
        return <Sliders className="w-4 h-4 text-purple-400" />;
      case 5:
      case 6:
        return <Brain className="w-4 h-4 text-emerald-400" />;
      case 7:
        return <Scale className="w-4 h-4 text-yellow-400" />;
      case 8:
      case 9:
        return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      case 10:
      case 11:
        return <Scale className="w-4 h-4 text-emerald-400" />;
      case 12:
      default:
        return <Zap className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Header with Decision Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              12-Step Signal Decision Engine
            </h3>
            <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">
              {outcome.symbol}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Strict sequential pipeline with non-discretionary risk gates
          </p>
        </div>

        {/* Big Decision Badge */}
        <div className="flex items-center space-x-3">
          <div className="text-right font-mono text-xs hidden sm:block">
            <span className="text-slate-400 block">Calibrated P(Up)</span>
            <span className="text-slate-100 font-bold">{(outcome.calibratedProb * 100).toFixed(1)}%</span>
          </div>

          <div
            className={`px-4 py-2 rounded-lg font-bold text-sm font-mono tracking-wider shadow-md flex items-center space-x-2 border ${
              outcome.decision === 'BUY'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                : outcome.decision === 'SELL'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : outcome.decision === 'HOLD'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {outcome.decision === 'BUY' ? (
              <TrendingUp className="w-4 h-4" />
            ) : outcome.decision === 'SELL' ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>DECISION: {outcome.decision}</span>
          </div>
        </div>
      </div>

      {/* Decision Summary Reason Banner */}
      <div className="mt-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800/90 text-xs font-mono flex items-start space-x-2">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-400">Pipeline Rationale: </span>
          <span className="text-slate-200 font-medium">{outcome.reason}</span>
        </div>
      </div>

      {/* 12-Step Flow Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {outcome.steps.map((s) => {
          const isSelected = selectedStep === s.step;
          return (
            <div
              key={s.step}
              onClick={() => setSelectedStep(isSelected ? null : s.step)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 border-cyan-500/70 shadow-lg ring-1 ring-cyan-500/30'
                  : s.passed
                  ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  : 'bg-rose-950/20 border-rose-900/50 hover:border-rose-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center space-x-1.5 font-mono">
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    #{s.step}
                  </span>
                  {getStepIcon(s.step)}
                  <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                    {s.name}
                  </span>
                </div>
                {s.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
              </div>

              <p className="text-[11px] text-slate-300 font-mono line-clamp-2 leading-relaxed">
                {s.statusText}
              </p>

              {/* Collapsible detail metadata */}
              {isSelected && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
                  <div>
                    <span className="text-slate-300 font-semibold">Audit Detail: </span>
                    {s.detail}
                  </div>
                  {s.meta && (
                    <div className="bg-slate-900 p-1.5 rounded border border-slate-800 overflow-x-auto text-emerald-300">
                      <pre>{JSON.stringify(s.meta, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Authorized Order Parameters Box (if BUY/SELL approved) */}
      {outcome.suggestedOrder && (
        <div className="mt-4 p-3.5 bg-emerald-950/20 border border-emerald-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-emerald-300 text-sm">
                Authorized MT5 Order: {outcome.suggestedOrder.action} {outcome.suggestedOrder.volume.toFixed(2)} Lots
              </div>
              <div className="text-slate-300 text-[11px] space-x-3">
                <span>Price: <b className="text-white">${outcome.suggestedOrder.price.toFixed(2)}</b></span>
                <span>SL: <b className="text-rose-400">${outcome.suggestedOrder.sl.toFixed(2)}</b></span>
                <span>TP: <b className="text-emerald-400">${outcome.suggestedOrder.tp.toFixed(2)}</b></span>
                <span>Risk: <b className="text-amber-300">${outcome.suggestedOrder.monetaryRisk.toFixed(2)}</b> (0.25%)</span>
              </div>
            </div>
          </div>

          {onExecuteManual && (
            <button
              onClick={onExecuteManual}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg shadow-md transition-colors text-xs flex items-center space-x-1.5"
            >
              <span>Transmit to Bridge</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
