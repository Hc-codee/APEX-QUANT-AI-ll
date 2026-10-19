import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSentimentComposite,
  validateSignalWithSentiment,
  getInitialSentiment,
  tickDriftSentiment,
} from './sentiment.ts';
import type { SentimentMetric } from '../types/index.ts';

test('calculateSentimentComposite computes correct weighted average and labels', () => {
  const metrics: SentimentMetric[] = [
    {
      id: 'm1',
      name: 'Metric 1',
      value: 80,
      displayValue: '80%',
      sentiment: 'BULLISH',
      weight: 0.5,
      description: 'Test 1',
    },
    {
      id: 'm2',
      name: 'Metric 2',
      value: 60,
      displayValue: '60%',
      sentiment: 'BULLISH',
      weight: 0.5,
      description: 'Test 2',
    },
  ];

  const result = calculateSentimentComposite(metrics);
  // (80 * 0.5 + 60 * 0.5) / 1.0 = 70
  assert.equal(result.compositeScore, 70);
  assert.equal(result.label, 'BULLISH');
  assert.equal(result.crowdRisk, false);
});

test('calculateSentimentComposite detects contrarian crowded retail long risk', () => {
  const crowdedLongMetrics: SentimentMetric[] = [
    {
      id: 'retail_ratio',
      name: 'Retail Long Ratio',
      value: 86, // 86% Long = extreme retail crowd
      displayValue: '86% Long',
      sentiment: 'BULLISH',
      weight: 0.5,
      description: 'Crowd test',
    },
    {
      id: 'institutional',
      name: 'Institutional Flow',
      value: 70,
      displayValue: '70',
      sentiment: 'BULLISH',
      weight: 0.5,
      description: 'Inst test',
    },
  ];

  const result = calculateSentimentComposite(crowdedLongMetrics);
  assert.equal(result.crowdRisk, true);
  assert.ok(result.crowdRiskDescription?.includes('Crowded Long'));
});

test('validateSignalWithSentiment confirms aligned BUY signal', () => {
  const result = validateSignalWithSentiment('BUY', 68, false);
  assert.equal(result.status, 'CONFIRMED');
  assert.ok(result.message.includes('confirmed'));
  assert.equal(result.crowdFilterPassed, true);
});

test('validateSignalWithSentiment triggers CONTRARIAN_WARNING on crowded long BUY', () => {
  const result = validateSignalWithSentiment(
    'BUY',
    82,
    true,
    'Crowded Long: Retail traders clustered at 86% Long'
  );
  assert.equal(result.status, 'CONTRARIAN_WARNING');
  assert.equal(result.crowdFilterPassed, false);
});

test('validateSignalWithSentiment cautions against divergence (BUY signal with Bearish sentiment)', () => {
  const result = validateSignalWithSentiment('BUY', 34, false);
  assert.equal(result.status, 'CAUTION');
  assert.ok(result.message.includes('Divergence caution'));
});

test('getInitialSentiment returns valid sentiment for each asset', () => {
  const gold = getInitialSentiment('XAUUSD');
  assert.equal(gold.symbolKey, 'XAUUSD');
  assert.ok(gold.compositeScore > 0 && gold.compositeScore < 100);
  assert.equal(gold.metrics.length, 4);

  const btc = getInitialSentiment('BTCUSD');
  assert.equal(btc.symbolKey, 'BTCUSD');
  assert.equal(btc.metrics.length, 4);

  const nasdaq = getInitialSentiment('NASDAQ');
  assert.equal(nasdaq.symbolKey, 'NASDAQ');
  assert.equal(nasdaq.metrics.length, 4);
});

test('tickDriftSentiment updates without mutating out of bounds', () => {
  const initial = getInitialSentiment('XAUUSD');
  const drifted = tickDriftSentiment(initial);
  assert.ok(drifted.compositeScore >= 0 && drifted.compositeScore <= 100);
  assert.equal(drifted.metrics.length, initial.metrics.length);
});
