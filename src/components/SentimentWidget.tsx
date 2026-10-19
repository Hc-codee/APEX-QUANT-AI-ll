import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Flame,
  Radio,
  Eye,
} from 'lucide-react';
import { AssetSymbolKey, SentimentData, SentimentValidationResult } from '../types';

interface SentimentWidgetProps {
  sentiment: SentimentData;
  validation: SentimentValidationResult;
  tradingDecision: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
  onSimulateCrowdSqueeze: () => void;
  onResetSentiment: () => void;
  isStreaming: boolean;
  onToggleStreaming: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SentimentWidget: React.FC<SentimentWidgetProps> = ({
  sentiment,
  validation,
  tradingDecision,
  onSimulateCrowdSqueeze,
  onResetSentiment,
  isStreaming,
  onToggleStreaming,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [showMetricDetails, setShowMetricDetails] = useState<boolean>(false);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 55) return 'text-cyan-400';
    if (score <= 30) return 'text-rose-400';
    if (score <= 45) return 'text-amber-400';
    return 'text-slate-300';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 55) return 'bg-cyan-500';
    if (score <= 30) return 'bg-rose-500';
    if (score <= 45) return 'bg-amber-500';
    return 'bg-slate-400';
  };

  const getValidationBadge = (status: SentimentValidationResult['status']) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>CONFIRMED BY SENTIMENT</span>
          </div>
        );
      case 'CONTRARIAN_WARNING':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[11px] font-bold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>CONTRARIAN CROWD WARNING</span>
          </div>
        );
      case 'CAUTION':
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>DIVERGENCE CAUTION</span>
          </div>
        );
      case 'NEUTRAL':
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>BALANCED SENTIMENT</span>
          </div>
        );
    }
  };

  return (
    <aside
      aria-label="Market Sentiment Engine Widget"
      className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden transition-all flex flex-col font-mono text-xs"
    >
      {/* Widget Header Strip */}
      <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-white uppercase text-xs tracking-wider">
                Market Sentiment
              </span>
              <span className="text-[10px] bg-slate-800 text-amber-400 px-1.5 py-0.2 rounded border border-slate-700 font-bold">
                {sentiment.symbolKey}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-slate-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>{isStreaming ? 'Live Stream: 2.0s' : 'Stream Paused'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {/* Stream Pause/Resume Toggle */}
          <button
            onClick={onToggleStreaming}
            title={isStreaming ? 'Pause Sentiment Ticks' : 'Resume Sentiment Ticks'}
            className={`p-1.5 rounded text-xs transition-colors ${
              isStreaming
                ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
          </button>

          {/* Reset Defaults */}
          <button
            onClick={onResetSentiment}
            title="Reset to Baseline"
            className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Collapse/Expand toggle */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand Sentiment Widget' : 'Collapse Sentiment Widget'}
              className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Main Composite Score Dial / Gauge Card */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase">Composite Sentiment Index</span>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${getScoreColor(
                  sentiment.compositeScore
                )}`}
              >
                {sentiment.label.replace('_', ' ')}
              </span>
            </div>

            {/* Score Big Display */}
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline space-x-1">
                <span className={`text-3xl font-extrabold ${getScoreColor(sentiment.compositeScore)}`}>
                  {sentiment.compositeScore}
                </span>
                <span className="text-slate-400 text-xs">/ 100</span>
              </div>
              <span className="text-[11px] text-slate-400">
                0=Extreme Fear • 100=Extreme Greed
              </span>
            </div>

            {/* Gauge Progress Bar */}
            <div className="relative w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getScoreBg(sentiment.compositeScore)}`}
                style={{ width: `${sentiment.compositeScore}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400">
              <span>0 (Extreme Bear)</span>
              <span>50 (Equilibrium)</span>
              <span>100 (Extreme Bull)</span>
            </div>
          </div>

          {/* Signal Validation Assistor Card */}
          <div
            className={`p-3.5 rounded-xl border transition-all space-y-2 ${
              validation.status === 'CONFIRMED'
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : validation.status === 'CONTRARIAN_WARNING'
                ? 'bg-amber-950/25 border-amber-500/50 ring-1 ring-amber-500/30'
                : validation.status === 'CAUTION'
                ? 'bg-rose-950/20 border-rose-500/40'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Signal Validation Impact
              </span>
              <span className="text-[10px] text-slate-400">
                Algorithmic Target: <b className="text-white">{tradingDecision}</b>
              </span>
            </div>

            {getValidationBadge(validation.status)}

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {validation.message}
            </p>

            {validation.scoreAdjustment !== 0 && (
              <div className="pt-1.5 border-t border-slate-800/80 text-[10px] flex items-center justify-between text-slate-400">
                <span>Model Confidence Adjuster:</span>
                <span
                  className={
                    validation.scoreAdjustment > 0
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {validation.scoreAdjustment > 0 ? '+' : ''}
                  {(validation.scoreAdjustment * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Underlying Multi-Source Sentiment Metrics Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                Underlying Indicators ({sentiment.metrics.length})
              </span>
              <button
                onClick={() => setShowMetricDetails(!showMetricDetails)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
              >
                <span>{showMetricDetails ? 'Hide Details' : 'Show Details'}</span>
                {showMetricDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <div className="space-y-2">
              {sentiment.metrics.map((m) => {
                const isBull = m.sentiment === 'BULLISH';
                const isBear = m.sentiment === 'BEARISH';
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-200 truncate max-w-[160px]">
                        {m.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isBull
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : isBear
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {m.displayValue}
                      </span>
                    </div>

                    {/* Progress Bar for metric value */}
                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full ${
                          m.value >= 55 ? 'bg-emerald-400' : m.value <= 45 ? 'bg-rose-400' : 'bg-slate-400'
                        }`}
                        style={{ width: `${m.value}%` }}
                      />
                    </div>

                    {showMetricDetails && (
                      <p className="text-[10px] text-slate-400 leading-tight mt-1 pt-1 border-t border-slate-800/60">
                        {m.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div className="pt-2 border-t border-slate-800 space-y-2 text-[11px]">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              Interactive Stress Testing
            </div>
            <button
              onClick={onSimulateCrowdSqueeze}
              className="w-full py-1.5 px-2.5 rounded bg-slate-800 hover:bg-amber-600/30 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 text-slate-300 text-xs font-semibold transition-all flex items-center justify-center space-x-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Crowded Retail Squeeze (88%)</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
