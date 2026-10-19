import { AssetSymbolKey, CandleData, Position, WorkerStatusJson } from '../types';

export interface AssetConfig {
  key: AssetSymbolKey;
  name: string;
  brokerSymbolDefault: string;
  aliases: string[];
  contractSize: number;
  pipSize: number;
  digits: number;
  volumeStep: number;
  volumeMin: number;
  volumeMax: number;
  maxSpreadPips: number;
  magicNumber: number;
  sessionDescription: string;
  tradingHours: string;
}

export const ASSET_CONFIGS: Record<AssetSymbolKey, AssetConfig> = {
  XAUUSD: {
    key: 'XAUUSD',
    name: 'Gold (XAU/USD)',
    brokerSymbolDefault: 'XAUUSD',
    aliases: ['GOLD', 'XAUUSDm', 'XAUUSD.', 'XAU.USD'],
    contractSize: 100, // 100 troy oz
    pipSize: 0.1,      // 1 pip = $0.10
    digits: 2,
    volumeStep: 0.01,
    volumeMin: 0.01,
    volumeMax: 20.0,
    maxSpreadPips: 3.5,
    magicNumber: 881001,
    sessionDescription: 'London & NY sessions active. Avoid 21:00-23:00 UTC rollover spread blowouts and Friday close.',
    tradingHours: '23:00 Sun - 21:00 Fri UTC',
  },
  BTCUSD: {
    key: 'BTCUSD',
    name: 'Bitcoin (BTC/USD)',
    brokerSymbolDefault: 'BTCUSD',
    aliases: ['BTCUSDm', 'XBTUSD', 'Bitcoin', 'BTC.USD'],
    contractSize: 1,   // 1 BTC per lot
    pipSize: 1.0,      // 1 pip = $1.00
    digits: 2,
    volumeStep: 0.01,
    volumeMin: 0.01,
    volumeMax: 5.0,
    maxSpreadPips: 30.0,
    magicNumber: 881002,
    sessionDescription: 'Continuous 24/7 crypto market. Watch weekend liquidity thins and Sunday weekly close rollover.',
    tradingHours: '24/7 Continuous',
  },
  NASDAQ: {
    key: 'NASDAQ',
    name: 'NASDAQ Index CFD (US100)',
    brokerSymbolDefault: 'US100',
    aliases: ['NAS100', 'USTEC', 'NDX', 'US100.cash', 'NAS100m'],
    contractSize: 1,   // $1 per point or broker unit
    pipSize: 1.0,      // 1 index point
    digits: 2,
    volumeStep: 0.1,
    volumeMin: 0.1,
    volumeMax: 50.0,
    maxSpreadPips: 2.5,
    magicNumber: 881003,
    sessionDescription: 'US Equity Cash session (13:30-20:00 UTC). First 10m whipsaw filter locked.',
    tradingHours: 'Mon-Fri 13:30 - 20:00 UTC (Core Cash)',
  },
};

// Generates synthetic historical candles for visualization
export function generateCandles(symbol: AssetSymbolKey, count: number = 40): CandleData[] {
  let basePrice = symbol === 'XAUUSD' ? 2720 : symbol === 'BTCUSD' ? 68400 : 20450;
  let volatility = symbol === 'XAUUSD' ? 2.5 : symbol === 'BTCUSD' ? 250 : 25;
  const now = Date.now();
  const candles: CandleData[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * 15 * 60 * 1000;
    const dateObj = new Date(timestamp);
    const time = `${dateObj.getUTCHours().toString().padStart(2, '0')}:${dateObj.getUTCMinutes().toString().padStart(2, '0')}`;
    const drift = Math.sin((count - i) * 0.25) * volatility * 1.5;
    const open = basePrice + drift;
    const high = open + Math.random() * volatility;
    const low = open - Math.random() * volatility;
    const close = low + Math.random() * (high - low);
    const volume = Math.floor(100 + Math.random() * 400);

    candles.push({
      time,
      timestamp,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
    basePrice = close;
  }
  return candles;
}

export const INITIAL_POSITIONS: Position[] = [
  {
    ticket: 1048291,
    symbol: 'XAUUSD',
    symbolKey: 'XAUUSD',
    action: 'BUY',
    volume: 0.12,
    openPrice: 2718.5,
    currentPrice: 2724.8,
    sl: 2715.0,
    tp: 2735.0,
    profit: 75.6,
    profitPips: 63,
    magic: 881001,
    openTime: '2026-10-19 14:15:00',
    trailingActive: true,
    breakevenActive: true,
  },
];

export const INITIAL_STATUS_JSON: WorkerStatusJson = {
  system_name: 'HC-NEXUS QUANT AI V1.0',
  operating_mode: 'PAPER',
  connection_status: 'ONLINE',
  last_update_utc: '2026-10-19 21:45:00',
  last_heartbeat_timestamp: Date.now() / 1000,
  selected_symbol: 'XAUUSD',
  broker_symbol_actual: 'XAUUSD',
  market_regime: 'TRENDING_BULL',
  trading_decision: 'HOLD',
  calibrated_probability: 0.638,
  entry_price: 2724.8,
  stop_loss: 2715.0,
  take_profit: 2735.0,
  position_size: 0.12,
  estimated_monetary_risk: 25.0,
  open_positions_count: 1,
  account_equity: 10248.5,
  account_balance: 10172.9,
  free_margin: 9840.0,
  unrealized_pnl: 75.6,
  realized_pnl_today: 172.9,
  daily_drawdown_pct: 0.18,
  daily_loss_limit_pct: 1.0,
  emergency_halt: false,
  decision_reason: 'Trend persistence model satisfied. Calibrated P(Up)=63.8% covers cost hurdles.',
};
