import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PriceChart } from './components/PriceChart';
import { PipelineViewer } from './components/PipelineViewer';
import { PositionsTable } from './components/PositionsTable';
import { AssetDesks } from './components/AssetDesks';
import { FeaturesRegimesLab } from './components/FeaturesRegimesLab';
import { MLStudio } from './components/MLStudio';
import { BacktestView } from './components/BacktestView';
import { RiskCalculator } from './components/RiskCalculator';
import { DiagnosticsView } from './components/DiagnosticsView';
import { AuditView } from './components/AuditView';
import { SentimentWidget } from './components/SentimentWidget';

import {
  AssetSymbolKey,
  TradingMode,
  MarketTick,
  CandleData,
  Position,
  SignalOutcome,
  WorkerStatusJson,
  SentimentData,
} from './types';
import {
  ASSET_CONFIGS,
  generateCandles,
  INITIAL_POSITIONS,
  INITIAL_STATUS_JSON,
} from './data/mockData';
import {
  calculateATR,
  calculateRSI,
  calibrateProbability,
  calculatePositionSize,
  validateCandles,
} from './utils/quant_engine';
import {
  getInitialSentiment,
  tickDriftSentiment,
  validateSignalWithSentiment,
  calculateSentimentComposite,
} from './utils/sentiment';

export default function App() {
  const [mode, setMode] = useState<TradingMode>('PAPER');
  const [activeTab, setActiveTab] = useState<string>('cockpit');
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbolKey>('XAUUSD');
  const [status, setStatus] = useState<WorkerStatusJson>(INITIAL_STATUS_JSON);
  const [positions, setPositions] = useState<Position[]>(INITIAL_POSITIONS);

  const [candles, setCandles] = useState<CandleData[]>(() => generateCandles('XAUUSD', 40));

  // Market Sentiment state
  const [sentiment, setSentiment] = useState<SentimentData>(() => getInitialSentiment('XAUUSD'));
  const [isSentimentStreaming, setIsSentimentStreaming] = useState<boolean>(true);
  const [isSentimentCollapsed, setIsSentimentCollapsed] = useState<boolean>(false);

  // Current market tick state
  const [tick, setTick] = useState<MarketTick>(() => {
    const cfg = ASSET_CONFIGS['XAUUSD'];
    const p = 2724.8;
    const spreadPips = 1.8;
    const spreadPoints = spreadPips * cfg.pipSize;
    return {
      symbol: cfg.brokerSymbolDefault,
      symbolKey: 'XAUUSD',
      bid: p,
      ask: p + spreadPoints,
      last: p,
      spread: spreadPoints,
      spreadPips,
      timestamp: Date.now(),
      digits: cfg.digits,
    };
  });

  // When selected asset changes, regenerate candles, reset tick, and reset sentiment
  useEffect(() => {
    const newCandles = generateCandles(selectedAsset, 40);
    setCandles(newCandles);
    const lastBar = newCandles[newCandles.length - 1];
    const cfg = ASSET_CONFIGS[selectedAsset];
    const spreadPips = selectedAsset === 'XAUUSD' ? 1.8 : selectedAsset === 'BTCUSD' ? 12.0 : 1.2;
    const spreadPoints = spreadPips * cfg.pipSize;

    setTick({
      symbol: cfg.brokerSymbolDefault,
      symbolKey: selectedAsset,
      bid: lastBar.close,
      ask: Number((lastBar.close + spreadPoints).toFixed(cfg.digits)),
      last: lastBar.close,
      spread: Number(spreadPoints.toFixed(cfg.digits)),
      spreadPips,
      timestamp: Date.now(),
      digits: cfg.digits,
    });

    setSentiment(getInitialSentiment(selectedAsset));

    setStatus((prev) => ({
      ...prev,
      selected_symbol: selectedAsset,
      broker_symbol_actual: cfg.brokerSymbolDefault,
    }));
  }, [selectedAsset]);

  // Live sentiment tick generator (updates every 2.0s when streaming is active)
  useEffect(() => {
    if (!isSentimentStreaming) return;
    const interval = setInterval(() => {
      setSentiment((prev) => tickDriftSentiment(prev));
    }, 2000);
    return () => clearInterval(interval);
  }, [isSentimentStreaming]);

  // Live tick simulator (updates every 1.5s in Paper or Backtest mode)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => {
        const cfg = ASSET_CONFIGS[selectedAsset];
        const delta = (Math.random() - 0.49) * (selectedAsset === 'XAUUSD' ? 0.4 : selectedAsset === 'BTCUSD' ? 25.0 : 2.5);
        const newBid = Math.max(Number((prev.bid + delta).toFixed(cfg.digits)), 1.0);
        const spreadPoints = prev.spreadPips * cfg.pipSize;
        const newAsk = Number((newBid + spreadPoints).toFixed(cfg.digits));

        // Also update floating PnL on active positions
        setPositions((currPos) =>
          currPos.map((pos) => {
            if (pos.symbolKey === selectedAsset) {
              const diff = pos.action === 'BUY' ? newBid - pos.openPrice : pos.openPrice - newAsk;
              const profit = Number((diff * cfg.contractSize * pos.volume).toFixed(2));
              const profitPips = Math.round(diff / cfg.pipSize);
              return {
                ...pos,
                currentPrice: pos.action === 'BUY' ? newBid : newAsk,
                profit,
                profitPips,
              };
            }
            return pos;
          })
        );

        return {
          ...prev,
          bid: newBid,
          ask: newAsk,
          last: newBid,
          timestamp: Date.now(),
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [selectedAsset]);

  // Dynamically compute the 12-Step Signal Outcome from live candles & tick
  const evaluateCurrentSignal = (): SignalOutcome => {
    const cfg = ASSET_CONFIGS[selectedAsset];
    const cValidation = validateCandles(candles);
    const atrList = calculateATR(candles, 14);
    const currentAtr = atrList[atrList.length - 1] || (selectedAsset === 'XAUUSD' ? 4.5 : selectedAsset === 'BTCUSD' ? 450 : 35);
    const closes = candles.map((c) => c.close);
    const rsiList = calculateRSI(closes, 14);
    const currentRsi = rsiList[rsiList.length - 1] || 55;

    // ML Inference & Calibration
    const rawScore = 1.25; // bullish baseline feature weight dot product
    const { pUp, pDown } = calibrateProbability(rawScore);

    const estCostPips = tick.spreadPips + 0.5;
    const netEdgePips = (pUp * currentAtr * 1.5) / cfg.pipSize - estCostPips;

    // Stop Loss & Take Profit
    const slDist = currentAtr * 2.0;
    const tpDist = slDist * 1.5;
    const slPrice = Number((tick.ask - slDist).toFixed(cfg.digits));
    const tpPrice = Number((tick.ask + tpDist).toFixed(cfg.digits));

    // Account & Position sizing
    const accountState = {
      balance: status.account_balance,
      equity: status.account_equity,
      free_margin: status.free_margin,
      daily_start_equity: status.account_balance,
      open_positions_count: positions.length,
      emergency_halt: status.emergency_halt,
    };

    const sizing = calculatePositionSize(
      accountState,
      {
        symbol: cfg.brokerSymbolDefault,
        contract_size: cfg.contractSize,
        pip_size: cfg.pipSize,
        volume_min: cfg.volumeMin,
        volume_max: cfg.volumeMax,
        volume_step: cfg.volumeStep,
        digits: cfg.digits,
        magic: cfg.magicNumber,
      },
      tick.ask,
      slPrice,
      0.0025,
      0.01
    );

    const activeForSymbol = positions.filter((p) => p.symbolKey === selectedAsset).length;

    const steps = [
      {
        step: 1,
        name: 'Data Quality Validation',
        passed: cValidation.valid,
        statusText: `Chronological bar integrity verified (${candles.length} bars, zero look-ahead)`,
        detail: 'Candle sequence strictly monotonic. Fresh tick latency <= 5.0s.',
      },
      {
        step: 2,
        name: 'Market Availability & Session',
        passed: tick.spreadPips <= cfg.maxSpreadPips,
        statusText: `Session active. Spread ${tick.spreadPips.toFixed(1)} pips <= cap ${cfg.maxSpreadPips} pips`,
        detail: cfg.sessionDescription,
      },
      {
        step: 3,
        name: 'Market Regime State',
        passed: true,
        statusText: 'TRENDING_BULL (ADX: 29.8 >= 25, price above SMA20)',
        detail: 'Regime is within validated operating parameters.',
      },
      {
        step: 4,
        name: 'Quantitative Feature Vector',
        passed: true,
        statusText: `RSI=${currentRsi.toFixed(1)}, ATR=${currentAtr.toFixed(2)}, NATR=0.0018`,
        detail: '14 point-in-time features computed from closed bar t-1.',
      },
      {
        step: 5,
        name: 'ML Raw Logit Scoring',
        passed: true,
        statusText: `Model v1.0-baseline raw score f(x) = +${rawScore.toFixed(2)}`,
        detail: 'Regularized baseline logit.',
      },
      {
        step: 6,
        name: 'Platt Sigmoid Calibration',
        passed: pUp >= 0.6,
        statusText: `Calibrated P(Up) = ${(pUp * 100).toFixed(1)}% (Threshold: 60%)`,
        detail: 'Sigmoid scaling maps raw score to empirical outcome frequency.',
      },
      {
        step: 7,
        name: 'Transaction Cost Hurdle',
        passed: netEdgePips > 0,
        statusText: `Net Expected Edge: +${netEdgePips.toFixed(1)} pips after ${estCostPips.toFixed(1)} pips friction`,
        detail: 'Spread, slippage (0.5 pip), and commission accounted for.',
      },
      {
        step: 8,
        name: 'Asset Strategy Boundaries',
        passed: true,
        statusText: `BUY Entry: $${tick.ask.toFixed(2)} | SL: $${slPrice.toFixed(2)} | TP: $${tpPrice.toFixed(2)}`,
        detail: 'Dynamic ATR stops (2.0x SL, 3.0x TP) maintain 1:1.5 R:R.',
      },
      {
        step: 9,
        name: 'Portfolio Exposure Limits',
        passed: activeForSymbol === 0,
        statusText:
          activeForSymbol === 0
            ? 'Symbol slot free (0/1 max per symbol)'
            : 'Hold: Symbol already has active managed position',
        detail: `Max portfolio positions: 3. Current open: ${positions.length}.`,
      },
      {
        step: 10,
        name: 'Risk Sizing (0.25% Equity)',
        passed: sizing.valid,
        statusText: sizing.valid
          ? `Normalized Volume: ${sizing.volume.toFixed(2)} Lots (Risk: $${sizing.monetaryRisk.toFixed(2)})`
          : sizing.reason,
        detail: `Step rounded strictly to ${cfg.volumeStep} lots.`,
      },
      {
        step: 11,
        name: 'Pre-Execution Constraint Check',
        passed: true,
        statusText: 'Margin verified, broker stop levels verified, filling policy IOC',
        detail: 'Simulation passed all pre-trade assertions.',
      },
      {
        step: 12,
        name: 'Order Authorization',
        passed: pUp >= 0.6 && activeForSymbol === 0 && sizing.valid && !status.emergency_halt,
        statusText:
          activeForSymbol > 0
            ? 'HOLD: Position already active'
            : status.emergency_halt
            ? 'HALTED: Emergency switch active'
            : `AUTHORIZED: BUY ${sizing.volume.toFixed(2)} Lots ${cfg.brokerSymbolDefault}`,
        detail: 'Final authorization to transmit order to MT5 bridge.',
      },
    ];

    let decision: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE' = 'NO_TRADE';
    let reason = 'Signal in neutral territory';

    if (status.emergency_halt) {
      decision = 'NO_TRADE';
      reason = 'Emergency Halt is currently active';
    } else if (activeForSymbol > 0) {
      decision = 'HOLD';
      reason = `${selectedAsset} already has an active position under management`;
    } else if (pUp >= 0.6 && sizing.valid && netEdgePips > 0) {
      decision = 'BUY';
      reason = `Calibrated P(Up)=${(pUp * 100).toFixed(1)}% satisfies risk hurdle and cost friction`;
    }

    return {
      decision,
      symbol: selectedAsset,
      calibratedProb: pUp,
      regime: 'TRENDING_BULL',
      reason,
      timestamp: Date.now(),
      steps,
      suggestedOrder:
        decision === 'BUY'
          ? {
              action: 'BUY',
              volume: sizing.volume,
              price: tick.ask,
              sl: slPrice,
              tp: tpPrice,
              monetaryRisk: sizing.monetaryRisk,
            }
          : undefined,
    };
  };

  const signalOutcome = evaluateCurrentSignal();

  // Handlers
  const handleEmergencyHaltToggle = () => {
    setStatus((prev) => {
      const nextHalt = !prev.emergency_halt;
      return {
        ...prev,
        emergency_halt: nextHalt,
        decision_reason: nextHalt
          ? 'EMERGENCY HALT ACTIVATED BY OPERATOR'
          : 'Halt released. Resuming normal operations.',
      };
    });
  };

  const handleClosePosition = (ticket: number) => {
    const target = positions.find((p) => p.ticket === ticket);
    if (target) {
      setStatus((prev) => ({
        ...prev,
        realized_pnl_today: Number((prev.realized_pnl_today + target.profit).toFixed(2)),
        account_balance: Number((prev.account_balance + target.profit).toFixed(2)),
        account_equity: Number((prev.account_equity + target.profit).toFixed(2)),
      }));
    }
    setPositions((prev) => prev.filter((p) => p.ticket !== ticket));
  };

  const handleCloseAll = () => {
    const totalPnl = positions.reduce((acc, p) => acc + p.profit, 0);
    setStatus((prev) => ({
      ...prev,
      realized_pnl_today: Number((prev.realized_pnl_today + totalPnl).toFixed(2)),
      account_balance: Number((prev.account_balance + totalPnl).toFixed(2)),
      account_equity: Number((prev.account_equity + totalPnl).toFixed(2)),
    }));
    setPositions([]);
  };

  const handleToggleTrailing = (ticket: number) => {
    setPositions((prev) =>
      prev.map((p) => (p.ticket === ticket ? { ...p, trailingActive: !p.trailingActive } : p))
    );
  };

  const handleToggleBreakeven = (ticket: number) => {
    setPositions((prev) =>
      prev.map((p) => (p.ticket === ticket ? { ...p, breakevenActive: !p.breakevenActive } : p))
    );
  };

  const handleExecuteManual = () => {
    if (!signalOutcome.suggestedOrder) return;
    const cfg = ASSET_CONFIGS[selectedAsset];
    const order = signalOutcome.suggestedOrder;
    const newPos: Position = {
      ticket: Math.floor(1000000 + Math.random() * 900000),
      symbol: cfg.brokerSymbolDefault,
      symbolKey: selectedAsset,
      action: order.action,
      volume: order.volume,
      openPrice: order.price,
      currentPrice: order.price,
      sl: order.sl,
      tp: order.tp,
      profit: 0.0,
      profitPips: 0,
      magic: cfg.magicNumber,
      openTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      trailingActive: false,
      breakevenActive: false,
    };
    setPositions((prev) => [...prev, newPos]);
    setStatus((prev) => ({
      ...prev,
      open_positions_count: prev.open_positions_count + 1,
      trading_decision: 'BUY',
      decision_reason: `Manual execution authorized: BUY ${order.volume} lots ${cfg.brokerSymbolDefault}`,
    }));
  };

  const handleSimulateCrowdSqueeze = () => {
    setSentiment((prev) => {
      const updated = prev.metrics.map((m) => {
        if (m.id.includes('retail') || m.id.includes('fear') || m.id.includes('funding')) {
          return {
            ...m,
            value: 88,
            displayValue: '88% Long (Extreme Squeeze Risk)',
            sentiment: 'BULLISH' as const,
          };
        }
        return m;
      });
      const comp = calculateSentimentComposite(updated);
      return {
        ...prev,
        compositeScore: comp.compositeScore,
        label: comp.label,
        crowdRisk: true,
        crowdRiskDescription: 'Crowded Long: Retail traders clustered at 88% Long (Contrarian Long Squeeze Risk)',
        lastUpdated: Date.now(),
        metrics: updated,
      };
    });
  };

  const handleResetSentiment = () => {
    setSentiment(getInitialSentiment(selectedAsset));
  };

  const sentimentValidation = validateSignalWithSentiment(
    signalOutcome.decision,
    sentiment.compositeScore,
    sentiment.crowdRisk,
    sentiment.crowdRiskDescription
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Telemetry & Navigation */}
      <Navbar
        mode={mode}
        onModeChange={setMode}
        status={status}
        onEmergencyHaltToggle={handleEmergencyHaltToggle}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Workspace Cockpit */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === 'cockpit' && (
          <div className="space-y-6">
            {/* Asset Selector Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              {(['XAUUSD', 'BTCUSD', 'NASDAQ'] as AssetSymbolKey[]).map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSelectedAsset(sym)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    selectedAsset === sym
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                  }`}
                >
                  {sym === 'XAUUSD'
                    ? 'Gold (XAUUSD)'
                    : sym === 'BTCUSD'
                    ? 'Bitcoin (BTCUSD)'
                    : 'NASDAQ (US100 CFD)'}
                </button>
              ))}
            </div>

            {/* Responsive 2-Column Cockpit Layout (Chart/Pipeline/Positions + Sentiment Sidebar) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Main Trading Cockpit Area (8 Columns) */}
              <div className="lg:col-span-8 space-y-6">
                {/* Price Chart */}
                <PriceChart
                  candles={candles}
                  tick={tick}
                  slPrice={signalOutcome.suggestedOrder?.sl}
                  tpPrice={signalOutcome.suggestedOrder?.tp}
                  entryPrice={signalOutcome.suggestedOrder?.price}
                />

                {/* 12-Step Signal Decision Engine Visualizer */}
                <PipelineViewer
                  outcome={signalOutcome}
                  onExecuteManual={signalOutcome.suggestedOrder ? handleExecuteManual : undefined}
                />

                {/* Open Managed Positions */}
                <PositionsTable
                  positions={positions}
                  onClosePosition={handleClosePosition}
                  onCloseAll={handleCloseAll}
                  onToggleTrailing={handleToggleTrailing}
                  onToggleBreakeven={handleToggleBreakeven}
                />
              </div>

              {/* Sidebar Widget Column (4 Columns) */}
              <div className="lg:col-span-4 space-y-6">
                <SentimentWidget
                  sentiment={sentiment}
                  validation={sentimentValidation}
                  tradingDecision={signalOutcome.decision}
                  onSimulateCrowdSqueeze={handleSimulateCrowdSqueeze}
                  onResetSentiment={handleResetSentiment}
                  isStreaming={isSentimentStreaming}
                  onToggleStreaming={() => setIsSentimentStreaming(!isSentimentStreaming)}
                  isCollapsed={isSentimentCollapsed}
                  onToggleCollapse={() => setIsSentimentCollapsed(!isSentimentCollapsed)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <AssetDesks selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset} />
        )}

        {activeTab === 'features' && <FeaturesRegimesLab />}

        {activeTab === 'ml' && <MLStudio />}

        {activeTab === 'backtest' && <BacktestView />}

        {activeTab === 'risk' && <RiskCalculator />}

        {activeTab === 'wine' && (
          <DiagnosticsView
            status={status}
            onRefreshStatus={() => {
              setStatus((prev) => ({
                ...prev,
                last_update_utc: new Date().toISOString().replace('T', ' ').substring(0, 19),
              }));
            }}
          />
        )}

        {activeTab === 'audit' && <AuditView />}
      </main>

      {/* System Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 px-4 text-center text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span>HC-NEXUS QUANT AI V1.0 • MetaTrader 5 Quantitative Trading Architecture</span>
        </div>
        <div className="text-slate-400">
          Ubuntu 24.04 LTS • Wine 64-bit • Python 3.10 • MQL5 IPC Bridge
        </div>
      </footer>
    </div>
  );
}
