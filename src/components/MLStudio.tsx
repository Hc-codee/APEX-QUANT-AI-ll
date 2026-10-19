import React, { useState } from 'react';
import { Brain, CheckCircle2, TrendingUp, AlertTriangle, ArrowRight, RotateCcw, ShieldCheck, Scale } from 'lucide-react';

export const MLStudio: React.FC = () => {
  const [modelStatus, setModelStatus] = useState({
    activeVersion: 'v1.0-baseline-platt',
    candidateVersion: 'v1.1-lightgbm-calibrated',
    retrainedAt: '2026-10-18 18:00 UTC',
    promotionStatus: 'PENDING_AUDIT',
  });

  const [rawInputScore, setRawInputScore] = useState<number>(1.2);

  // Dynamic Platt Sigmoid function
  const z = -1.18 * rawInputScore + 0.01;
  const calibratedPUp = 1 / (1 + Math.exp(Math.max(Math.min(z, 20), -20)));
  const calibratedPDown = 1 - calibratedPUp;

  // Reliability diagram data points: [predicted_bin_center, observed_frequency]
  const reliabilityPoints = [
    { pred: 0.1, obs: 0.12 },
    { pred: 0.2, obs: 0.19 },
    { pred: 0.3, obs: 0.28 },
    { pred: 0.4, obs: 0.42 },
    { pred: 0.5, obs: 0.49 },
    { pred: 0.6, obs: 0.58 },
    { pred: 0.7, obs: 0.71 },
    { pred: 0.8, obs: 0.79 },
    { pred: 0.9, obs: 0.88 },
  ];

  return (
    <div className="space-y-6">
      {/* ML Architecture Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              Machine Learning Architecture & Probability Calibration Studio
            </h3>
          </div>
          <span className="text-xs bg-slate-800 text-emerald-400 font-mono px-2.5 py-1 rounded border border-emerald-500/30">
            Active: {modelStatus.activeVersion}
          </span>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-2 leading-relaxed">
          Standard classification models output uncalibrated logits that cannot be used for direct Kelly or risk-based sizing. HC-NEXUS applies strictly out-of-sample Platt sigmoid scaling to guarantee probabilistic accuracy (evaluated via Brier Score and Log Loss).
        </p>

        {/* Evaluation Metrics Cards */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Brier Score</span>
            <span className="font-bold text-emerald-400 text-base">0.184</span>
            <span className="text-[10px] text-slate-400 block">Target: &lt; 0.22 (Passed)</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Log Loss (Cross-Entropy)</span>
            <span className="font-bold text-cyan-400 text-base">0.542</span>
            <span className="text-[10px] text-slate-400 block">Baseline Coin Toss: 0.693</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Out-Of-Sample AUC</span>
            <span className="font-bold text-purple-400 text-base">0.768</span>
            <span className="text-[10px] text-slate-400 block">Walk-forward validated</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">NO TRADE Band</span>
            <span className="font-bold text-amber-400 text-base">45% — 55%</span>
            <span className="text-[10px] text-slate-400 block">Zero edge rejection</span>
          </div>
        </div>
      </div>

      {/* Interactive Probability Calibration Curve & Reliability Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Platt Sigmoid Simulator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-3 flex items-center space-x-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            <span>Interactive Platt Sigmoid Calibration</span>
          </h4>
          <p className="text-xs text-slate-400 font-mono mb-4">
            Test how raw model logit score f(x) maps to calibrated probability P(Up):
          </p>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4 font-mono text-xs">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Raw Model Logit: <b>{rawInputScore.toFixed(2)}</b></span>
                <span className="text-slate-400">Range: [-3.0 to +3.0]</span>
              </div>
              <input
                type="range"
                min="-3.0"
                max="3.0"
                step="0.1"
                value={rawInputScore}
                onChange={(e) => setRawInputScore(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-slate-900 p-3 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Calibrated P(Up)</span>
                <span className="text-emerald-400 font-bold text-lg">{(calibratedPUp * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-slate-900 p-3 rounded border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Calibrated P(Down)</span>
                <span className="text-rose-400 font-bold text-lg">{(calibratedPDown * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800">
              <b>Decision Threshold Check: </b>
              {calibratedPUp >= 0.6 ? (
                <span className="text-emerald-400 font-bold">BUY Signal (P &gt;= 60%)</span>
              ) : calibratedPUp <= 0.4 ? (
                <span className="text-rose-400 font-bold">SELL Signal (P &lt;= 40%)</span>
              ) : (
                <span className="text-amber-400 font-bold">NO TRADE / HOLD (Inside 40%-60% Noise Band)</span>
              )}
            </div>
          </div>
        </div>

        {/* Reliability Diagram (Calibration Curve) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-3 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Reliability Diagram (Empirical vs Calibrated)</span>
          </h4>
          <p className="text-xs text-slate-400 font-mono mb-2">
            Close alignment with the 45-degree diagonal proves the model probabilities represent true historical frequencies.
          </p>

          <div className="h-48 w-full relative mt-3">
            <svg viewBox="0 0 240 180" className="w-full h-full">
              {/* Axes and Grid */}
              <line x1="30" y1="20" x2="30" y2="150" stroke="#334155" strokeWidth="1" />
              <line x1="30" y1="150" x2="220" y2="150" stroke="#334155" strokeWidth="1" />

              {/* 45 Degree Diagonal (Perfect Calibration Line) */}
              <line
                x1="30"
                y1="150"
                x2="220"
                y2="20"
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />

              {/* Actual Empirical Points & Connecting Line */}
              <polyline
                points={reliabilityPoints
                  .map((p) => {
                    const x = 30 + p.pred * 190;
                    const y = 150 - p.obs * 130;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />

              {reliabilityPoints.map((p, i) => {
                const x = 30 + p.pred * 190;
                const y = 150 - p.obs * 130;
                return <circle key={i} cx={x} cy={y} r="3" fill="#34d399" />;
              })}

              <text x="125" y="170" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">
                Predicted Probability
              </text>
              <text x="10" y="85" fill="#94a3b8" fontSize="8" textAnchor="middle" transform="rotate(-90 10 85)" fontFamily="monospace">
                Observed Frequency
              </text>
            </svg>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-slate-500 inline-block" />
              <span>Perfect Diagonal (Y = X)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
              <span>Platt Model Empirical Curve</span>
            </span>
          </div>
        </div>
      </div>

      {/* Model Governance & Promotion Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl font-mono text-xs">
        <h4 className="text-sm font-bold text-white uppercase tracking-wide mb-3 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>Model Retraining & Controlled Promotion Governance</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-slate-400 uppercase text-[10px]">Production Model</div>
            <div className="font-bold text-white text-sm">{modelStatus.activeVersion}</div>
            <div className="text-slate-400 text-[11px]">Deployed: 2026-10-10</div>
            <div className="text-emerald-400 text-[11px]">Out-of-sample Sharpe: 1.82</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
            <div className="text-slate-400 uppercase text-[10px]">Candidate Model</div>
            <div className="font-bold text-cyan-300 text-sm">{modelStatus.candidateVersion}</div>
            <div className="text-slate-400 text-[11px]">Trained: {modelStatus.retrainedAt}</div>
            <div className="text-cyan-400 text-[11px]">Out-of-sample Sharpe: 1.94</div>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-slate-400 uppercase text-[10px]">Promotion Gate</div>
              <div className="text-[11px] text-slate-300 mt-1">Requires 30 days paper proof before replacing production model.</div>
            </div>
            <div className="flex space-x-2 mt-3">
              <button
                onClick={() => alert('Model promotion simulated: candidate passes all out-of-sample validation gates.')}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                Promote
              </button>
              <button
                onClick={() => alert('Immediate rollback executed. Previous baseline restored.')}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Rollback</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
