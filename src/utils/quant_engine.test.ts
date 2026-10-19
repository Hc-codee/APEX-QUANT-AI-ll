import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateATR,
  calculateRSI,
  calibrateProbability,
  calculateBrierScore,
  calculatePositionSize,
  validateCandles,
  type Candle,
  type SymbolSpec,
  type AccountState,
} from './quant_engine.ts';

test('calculateATR Wilder smoothing computes correct non-zero volatility', () => {
  const candles: Candle[] = [];
  for (let i = 0; i < 30; i++) {
    candles.push({
      timestamp: 1000 + i * 60,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 1000,
    });
  }

  const atr = calculateATR(candles, 14);
  assert.equal(atr.length, 30);
  const lastAtr = atr[atr.length - 1];
  assert.ok(lastAtr > 9.0 && lastAtr < 11.0, `Expected ATR ~10, got ${lastAtr}`);
});

test('calculateRSI responds to trend momentum and clamps 0 to 100', () => {
  // Uptrend series
  const upCloses = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
  const rsiUp = calculateRSI(upCloses, 14);
  const lastRsiUp = rsiUp[rsiUp.length - 1];
  assert.ok(lastRsiUp > 90, `Expected overbought RSI > 90, got ${lastRsiUp}`);

  // Downtrend series
  const downCloses = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
  const rsiDown = calculateRSI(downCloses, 14);
  const lastRsiDown = rsiDown[rsiDown.length - 1];
  assert.ok(lastRsiDown < 10, `Expected oversold RSI < 10, got ${lastRsiDown}`);
});

test('calibrateProbability computes monotonic Platt scaling sigmoid', () => {
  const neutral = calibrateProbability(0.0);
  assert.ok(Math.abs(neutral.pUp - 0.5) < 0.05);

  const bullish = calibrateProbability(2.5);
  assert.ok(bullish.pUp > 0.85);
  assert.ok(bullish.pDown < 0.15);
  assert.equal(Number((bullish.pUp + bullish.pDown).toFixed(3)), 1.0);

  const bearish = calibrateProbability(-2.5);
  assert.ok(bearish.pUp < 0.15);
  assert.ok(bearish.pDown > 0.85);
});

test('calculateBrierScore returns correct mean squared error', () => {
  // Perfect prediction
  const perfect = calculateBrierScore([1.0, 0.0, 1.0], [1, 0, 1]);
  assert.equal(perfect, 0.0);

  // Uninformative 50/50 prediction
  const coinToss = calculateBrierScore([0.5, 0.5], [1, 0]);
  assert.equal(coinToss, 0.25);
});

test('calculatePositionSize enforces 0.25% equity risk and volume step rounding', () => {
  const account: AccountState = {
    balance: 10000,
    equity: 10000,
    free_margin: 10000,
    daily_start_equity: 10000,
    open_positions_count: 0,
    emergency_halt: false,
  };

  const goldSpec: SymbolSpec = {
    symbol: 'XAUUSD',
    contract_size: 100, // 100 oz per lot
    pip_size: 0.1,
    volume_min: 0.01,
    volume_max: 20.0,
    volume_step: 0.01,
    digits: 2,
    magic: 881001,
  };

  // $10 stop loss distance = $10 * 100 oz = $1000 loss per 1.0 lot
  // 0.25% risk on $10,000 = $25 budget
  // 25 / 1000 = 0.025 lots -> floor to 0.02 lots
  const result = calculatePositionSize(account, goldSpec, 2720.0, 2710.0, 0.0025);
  assert.equal(result.valid, true);
  assert.equal(result.volume, 0.02);
  assert.ok(result.monetaryRisk <= 25.0);
});

test('calculatePositionSize halts when daily drawdown exceeds 1.0%', () => {
  const breachedAccount: AccountState = {
    balance: 9880,
    equity: 9880, // 1.2% drawdown
    free_margin: 9880,
    daily_start_equity: 10000,
    open_positions_count: 0,
    emergency_halt: false,
  };

  const btcSpec: SymbolSpec = {
    symbol: 'BTCUSD',
    contract_size: 1,
    pip_size: 1.0,
    volume_min: 0.01,
    volume_max: 5.0,
    volume_step: 0.01,
    digits: 2,
    magic: 881002,
  };

  const result = calculatePositionSize(breachedAccount, btcSpec, 68000, 67500, 0.0025, 0.01);
  assert.equal(result.valid, false);
  assert.ok(result.reason.includes('Daily loss limit breached'));
});

test('validateCandles catches corrupted bars and timestamp gaps', () => {
  const validBars: Candle[] = Array.from({ length: 25 }, (_, i) => ({
    timestamp: 1000 + i * 900,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 50,
  }));
  assert.equal(validateCandles(validBars).valid, true);

  const corruptedBar: Candle[] = [
    ...validBars,
    { timestamp: 99999, open: 100, high: 90, low: 110, close: 95, volume: 10 },
  ];
  assert.equal(validateCandles(corruptedBar).valid, false);
});
