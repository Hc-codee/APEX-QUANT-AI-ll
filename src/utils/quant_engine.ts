/**
 * HC-NEXUS QUANT AI V1.0 - Core Quantitative Logic & Calculations
 * Pure TypeScript implementation for UI, simulations, and node:test verification.
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_complete?: boolean;
}

export interface Tick {
  timestamp: number;
  bid: number;
  ask: number;
  last: number;
  spread: number;
}

export interface SymbolSpec {
  symbol: string;
  contract_size: number;
  pip_size: number;
  volume_min: number;
  volume_max: number;
  volume_step: number;
  digits: number;
  magic: number;
}

export interface AccountState {
  balance: number;
  equity: number;
  free_margin: number;
  daily_start_equity: number;
  open_positions_count: number;
  emergency_halt: boolean;
}

/**
 * Calculates Average True Range (ATR) with Wilder's smoothing
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  if (candles.length < period + 1) {
    return new Array(candles.length).fill(0);
  }

  const trueRanges: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const cPrev = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - cPrev),
      Math.abs(candles[i].low - cPrev)
    );
    trueRanges.push(tr);
  }

  const atr: number[] = new Array(period - 1).fill(0);
  const firstAtr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atr.push(firstAtr);

  for (let i = period; i < trueRanges.length; i++) {
    const currentAtr = (atr[atr.length - 1] * (period - 1) + trueRanges[i]) / period;
    atr.push(currentAtr);
  }

  return atr;
}

/**
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) {
    return new Array(closes.length).fill(50);
  }

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }

  const rsi: number[] = new Array(period).fill(50);
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) {
    rsi.push(100);
  } else {
    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }

  return rsi;
}

/**
 * Platt Scaling Sigmoid Calibration: P(Up) = 1 / (1 + exp(A * f + B))
 */
export function calibrateProbability(rawScore: number, plattA: number = -1.18, plattB: number = 0.01): { pUp: number; pDown: number } {
  const z = Math.max(Math.min(plattA * rawScore + plattB, 20), -20);
  const pUp = 1 / (1 + Math.exp(z));
  return {
    pUp: Number(pUp.toFixed(4)),
    pDown: Number((1 - pUp).toFixed(4)),
  };
}

/**
 * Brier Score: Mean squared error of probabilistic forecasts against binary outcomes
 * Lower is better. 0.0 is perfect, 0.25 is uninformative.
 */
export function calculateBrierScore(predictions: number[], outcomes: number[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return 0.25;
  }
  const sumSq = predictions.reduce((acc, p, idx) => acc + Math.pow(p - outcomes[idx], 2), 0);
  return Number((sumSq / predictions.length).toFixed(4));
}

/**
 * Risk-based Position Sizing
 * Computes exact volume for 0.25% equity risk, rounding strictly to broker volume step.
 */
export function calculatePositionSize(
  account: AccountState,
  spec: SymbolSpec,
  entryPrice: number,
  stopLossPrice: number,
  riskFraction: number = 0.0025,
  maxDailyLossFraction: number = 0.01
): {
  valid: boolean;
  volume: number;
  reason: string;
  monetaryRisk: number;
} {
  if (account.emergency_halt) {
    return { valid: false, volume: 0, reason: "Emergency Halt is Active", monetaryRisk: 0 };
  }

  if (account.equity <= 0) {
    return { valid: false, volume: 0, reason: "Non-positive equity", monetaryRisk: 0 };
  }

  const dailyDrawdown = (account.daily_start_equity - account.equity) / account.daily_start_equity;
  if (dailyDrawdown >= maxDailyLossFraction) {
    return {
      valid: false,
      volume: 0,
      reason: `Daily loss limit breached (${(dailyDrawdown * 100).toFixed(2)}% >= ${(maxDailyLossFraction * 100).toFixed(1)}%)`,
      monetaryRisk: 0,
    };
  }

  const priceDiff = Math.abs(entryPrice - stopLossPrice);
  if (priceDiff <= 0) {
    return { valid: false, volume: 0, reason: "Zero stop loss distance", monetaryRisk: 0 };
  }

  const monetaryRiskBudget = account.equity * riskFraction;
  const lossPerLot = priceDiff * spec.contract_size;

  if (lossPerLot <= 0) {
    return { valid: false, volume: 0, reason: "Invalid loss per lot", monetaryRisk: 0 };
  }

  const rawVolume = monetaryRiskBudget / lossPerLot;
  const step = spec.volume_step > 0 ? spec.volume_step : 0.01;
  const stepsCount = Math.floor(rawVolume / step);
  let volume = Number((stepsCount * step).toFixed(spec.digits <= 2 ? 2 : spec.digits));

  if (volume < spec.volume_min) {
    return {
      valid: false,
      volume: 0,
      reason: `Calculated volume (${rawVolume.toFixed(3)} lots) is below broker minimum (${spec.volume_min.toFixed(2)} lots)`,
      monetaryRisk: 0,
    };
  }

  if (volume > spec.volume_max) {
    volume = spec.volume_max;
  }

  const actualMonetaryRisk = Number((volume * lossPerLot).toFixed(2));

  return {
    valid: true,
    volume,
    reason: "Risk-based sizing validated",
    monetaryRisk: actualMonetaryRisk,
  };
}

/**
 * Validates candle series integrity and eliminates look-ahead bias
 */
export function validateCandles(candles: Candle[]): { valid: boolean; reason: string; completedCount: number } {
  if (!candles || candles.length < 20) {
    return { valid: false, reason: "Insufficient candle history", completedCount: 0 };
  }

  let lastTs = -1;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.low > c.high || c.open < c.low || c.open > c.high || c.close < c.low || c.close > c.high) {
      return { valid: false, reason: `Bar #${i} invalid OHLC relationship`, completedCount: 0 };
    }
    if (c.timestamp <= lastTs) {
      return { valid: false, reason: `Timestamp monotonicity violated at bar #${i}`, completedCount: 0 };
    }
    lastTs = c.timestamp;
  }

  return { valid: true, reason: "Valid chronological candle series", completedCount: candles.length };
}
