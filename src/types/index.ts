export type TradingMode = 'BACKTEST' | 'PAPER' | 'LIVE';

export type AssetSymbolKey = 'XAUUSD' | 'BTCUSD' | 'NASDAQ';

export interface MarketTick {
  symbol: string;
  symbolKey: AssetSymbolKey;
  bid: number;
  ask: number;
  last: number;
  spread: number;
  spreadPips: number;
  timestamp: number;
  digits: number;
}

export interface CandleData {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  ticket: number;
  symbol: string;
  symbolKey: AssetSymbolKey;
  action: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  profitPips: number;
  magic: number;
  openTime: string;
  trailingActive: boolean;
  breakevenActive: boolean;
}

export interface PipelineStep {
  step: number;
  name: string;
  passed: boolean;
  statusText: string;
  detail: string;
  meta?: Record<string, any>;
}

export interface SignalOutcome {
  decision: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE';
  symbol: AssetSymbolKey;
  calibratedProb: number;
  regime: string;
  reason: string;
  timestamp: number;
  steps: PipelineStep[];
  suggestedOrder?: {
    action: 'BUY' | 'SELL';
    volume: number;
    price: number;
    sl: number;
    tp: number;
    monetaryRisk: number;
  };
}

export interface WorkerStatusJson {
  system_name: string;
  operating_mode: string;
  connection_status: string;
  last_update_utc: string;
  last_heartbeat_timestamp: number;
  selected_symbol: string;
  broker_symbol_actual: string;
  market_regime: string;
  trading_decision: string;
  calibrated_probability: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  position_size: number;
  estimated_monetary_risk: number;
  open_positions_count: number;
  account_equity: number;
  account_balance: number;
  free_margin: number;
  unrealized_pnl: number;
  realized_pnl_today: number;
  daily_drawdown_pct: number;
  daily_loss_limit_pct: number;
  emergency_halt: boolean;
  decision_reason: string;
}

export interface SentimentMetric {
  id: string;
  name: string;
  value: number;
  displayValue: string;
  unit?: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  weight: number;
  description: string;
}

export interface SentimentData {
  symbolKey: AssetSymbolKey;
  compositeScore: number; // 0 to 100
  label: 'EXTREME_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'EXTREME_BULLISH';
  crowdRisk: boolean; // true if retail crowd is over-extended (>75% one way)
  crowdRiskDescription?: string;
  lastUpdated: number;
  metrics: SentimentMetric[];
}

export interface SentimentValidationResult {
  status: 'CONFIRMED' | 'CAUTION' | 'CONTRARIAN_WARNING' | 'NEUTRAL';
  message: string;
  scoreAdjustment: number;
  crowdFilterPassed: boolean;
}
