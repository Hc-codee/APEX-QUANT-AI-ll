/**
 * HC-NEXUS QUANT AI V1.0 - Market Sentiment Simulation & Signal Validation
 * Pure logic module for real-time sentiment extraction, contrarian crowd detection,
 * and multi-factor signal validation.
 */

import type { AssetSymbolKey, SentimentData, SentimentMetric, SentimentValidationResult } from '../types/index.ts';

/**
 * Calculates a weighted composite sentiment score normalized between 0 and 100.
 * Also evaluates contrarian crowd risk when retail traders are over-leveraged in one direction.
 */
export function calculateSentimentComposite(metrics: SentimentMetric[]): {
  compositeScore: number;
  label: 'EXTREME_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'EXTREME_BULLISH';
  crowdRisk: boolean;
  crowdRiskDescription?: string;
} {
  if (!metrics || metrics.length === 0) {
    return { compositeScore: 50, label: 'NEUTRAL', crowdRisk: false };
  }

  const totalWeight = metrics.reduce((acc, m) => acc + m.weight, 0);
  if (totalWeight <= 0) {
    return { compositeScore: 50, label: 'NEUTRAL', crowdRisk: false };
  }

  const weightedSum = metrics.reduce((acc, m) => acc + m.value * m.weight, 0);
  const compositeScore = Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)));

  let label: 'EXTREME_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'EXTREME_BULLISH';
  if (compositeScore >= 78) label = 'EXTREME_BULLISH';
  else if (compositeScore >= 58) label = 'BULLISH';
  else if (compositeScore <= 22) label = 'EXTREME_BEARISH';
  else if (compositeScore <= 42) label = 'BEARISH';
  else label = 'NEUTRAL';

  // Contrarian crowd check: retail positioning > 75% long or short creates high squeeze risk
  const retailMetric = metrics.find(
    (m) => m.id === 'retail_ratio' || m.id === 'retail_long_pct' || m.id === 'funding_rate'
  );
  let crowdRisk = false;
  let crowdRiskDescription: string | undefined;

  if (retailMetric) {
    if (retailMetric.value >= 78) {
      crowdRisk = true;
      crowdRiskDescription = `Crowded Long: Retail traders heavily clustered at ${retailMetric.value.toFixed(0)}% Long (Contrarian Long Squeeze Risk)`;
    } else if (retailMetric.value <= 22) {
      crowdRisk = true;
      crowdRiskDescription = `Crowded Short: Retail traders clustered at ${(100 - retailMetric.value).toFixed(0)}% Short (Contrarian Short Squeeze Risk)`;
    }
  }

  return { compositeScore, label, crowdRisk, crowdRiskDescription };
}

/**
 * Validates a trading signal (BUY / SELL / HOLD / NO_TRADE) against sentiment metrics.
 * 
 * Rules:
 * - If BUY signal and composite sentiment is BULLISH/EXTREME_BULLISH without crowd squeeze -> CONFIRMED
 * - If BUY signal but retail is crowded long (>78%) -> CONTRARIAN_WARNING (contrarian reversal risk)
 * - If BUY signal and composite sentiment is BEARISH (<40%) -> CAUTION (technical/sentiment divergence)
 * - If SELL signal and composite sentiment is BEARISH without crowd squeeze -> CONFIRMED
 * - If SELL signal but retail is crowded short (<22%) -> CONTRARIAN_WARNING
 * - If SELL signal and sentiment is BULLISH (>60%) -> CAUTION
 */
export function validateSignalWithSentiment(
  decision: 'BUY' | 'SELL' | 'HOLD' | 'NO_TRADE',
  compositeScore: number,
  crowdRisk: boolean,
  crowdRiskDescription?: string
): SentimentValidationResult {
  if (decision === 'HOLD' || decision === 'NO_TRADE') {
    return {
      status: 'NEUTRAL',
      message: 'No active trade direction to validate against sentiment.',
      scoreAdjustment: 0,
      crowdFilterPassed: true,
    };
  }

  if (decision === 'BUY') {
    if (crowdRisk && compositeScore >= 75) {
      return {
        status: 'CONTRARIAN_WARNING',
        message: crowdRiskDescription || 'Warning: Extreme one-sided retail bullish crowd creates reversal risk.',
        scoreAdjustment: -0.05,
        crowdFilterPassed: false,
      };
    }
    if (compositeScore >= 55) {
      return {
        status: 'CONFIRMED',
        message: `Signal confirmed: Multi-source sentiment (${compositeScore}/100) aligns with technical BUY bias.`,
        scoreAdjustment: +0.03,
        crowdFilterPassed: true,
      };
    }
    if (compositeScore < 45) {
      return {
        status: 'CAUTION',
        message: `Divergence caution: Sentiment is bearish (${compositeScore}/100) while technicals indicate BUY.`,
        scoreAdjustment: -0.04,
        crowdFilterPassed: true,
      };
    }
    return {
      status: 'NEUTRAL',
      message: `Sentiment is balanced (${compositeScore}/100). Technical setup remains dominant.`,
      scoreAdjustment: 0,
      crowdFilterPassed: true,
    };
  }

  if (decision === 'SELL') {
    if (crowdRisk && compositeScore <= 25) {
      return {
        status: 'CONTRARIAN_WARNING',
        message: crowdRiskDescription || 'Warning: Extreme one-sided retail bearish crowd creates short squeeze risk.',
        scoreAdjustment: -0.05,
        crowdFilterPassed: false,
      };
    }
    if (compositeScore <= 45) {
      return {
        status: 'CONFIRMED',
        message: `Signal confirmed: Multi-source sentiment (${compositeScore}/100) aligns with technical SELL bias.`,
        scoreAdjustment: +0.03,
        crowdFilterPassed: true,
      };
    }
    if (compositeScore > 55) {
      return {
        status: 'CAUTION',
        message: `Divergence caution: Sentiment is bullish (${compositeScore}/100) while technicals indicate SELL.`,
        scoreAdjustment: -0.04,
        crowdFilterPassed: true,
      };
    }
    return {
      status: 'NEUTRAL',
      message: `Sentiment is balanced (${compositeScore}/100). Technical setup remains dominant.`,
      scoreAdjustment: 0,
      crowdFilterPassed: true,
    };
  }

  return {
    status: 'NEUTRAL',
    message: 'Sentiment alignment neutral.',
    scoreAdjustment: 0,
    crowdFilterPassed: true,
  };
}

/**
 * Generates initial simulated real-time market sentiment data for each asset.
 */
export function getInitialSentiment(symbol: AssetSymbolKey): SentimentData {
  let metrics: SentimentMetric[] = [];

  if (symbol === 'XAUUSD') {
    metrics = [
      {
        id: 'retail_ratio',
        name: 'Retail Broker Positioning',
        value: 64, // 64% Long
        displayValue: '64% Long / 36% Short',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Aggregate retail broker long/short open interest ratio',
      },
      {
        id: 'cot_commercial',
        name: 'Institutional COT Commercials',
        value: 71,
        displayValue: '+18.4k Net Contracts',
        sentiment: 'BULLISH',
        weight: 0.30,
        description: 'CFTC Commitment of Traders smart-money bullion banks positioning',
      },
      {
        id: 'real_yields',
        name: 'US 10Y Real Yield Flow',
        value: 58,
        displayValue: 'Yields Softening (-4 bps)',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Negative correlation with real interest rates supports Gold bullion',
      },
      {
        id: 'safe_haven_index',
        name: 'Geopolitical Risk Safe-Haven Index',
        value: 67,
        displayValue: 'Elevated (Score: 67)',
        sentiment: 'BULLISH',
        weight: 0.20,
        description: 'Safe-haven hedge demand proxy from currency and bond skews',
      },
    ];
  } else if (symbol === 'BTCUSD') {
    metrics = [
      {
        id: 'crypto_fear_greed',
        name: 'Crypto Fear & Greed Index',
        value: 72,
        displayValue: '72 (Greed)',
        sentiment: 'BULLISH',
        weight: 0.30,
        description: 'Volatility, market volume, social media, and Google Trends gauge',
      },
      {
        id: 'funding_rate',
        name: 'Perpetual Futures Funding Rate',
        value: 62,
        displayValue: '+0.0118% / 8h',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Positive funding shows mild long bias without excessive leverage',
      },
      {
        id: 'orderbook_depth',
        name: 'Orderbook Bid/Ask Volume Depth',
        value: 68,
        displayValue: '+14.2% Bid Depth ($25M)',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Depth within 1% of mid-market price on primary spot exchanges',
      },
      {
        id: 'whale_exchange_flow',
        name: 'Whale Exchange Inflow/Outflow',
        value: 65,
        displayValue: 'Net Outflows (-1,840 BTC)',
        sentiment: 'BULLISH',
        weight: 0.20,
        description: 'Net coins leaving exchanges indicating long-term cold custody accumulation',
      },
    ];
  } else {
    // NASDAQ (US100 CFD)
    metrics = [
      {
        id: 'put_call_ratio',
        name: 'CBOE Equity Put/Call Ratio',
        value: 62,
        displayValue: '0.78 (Call Dominance)',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Lower put/call indicates institutional equity upside positioning',
      },
      {
        id: 'vix_term_structure',
        name: 'VIX Volatility Term Structure',
        value: 68,
        displayValue: 'Contango (+6.2%)',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Futures in normal contango signaling steady equity market expectations',
      },
      {
        id: 'retail_ratio',
        name: 'AAII Retail Investor Sentiment',
        value: 54,
        displayValue: '42% Bull / 31% Bear',
        sentiment: 'NEUTRAL',
        weight: 0.25,
        description: 'American Association of Individual Investors weekly allocation sentiment',
      },
      {
        id: 'breadth_advance_decline',
        name: 'Tech Mega-Cap (Mag 7) Breadth',
        value: 74,
        displayValue: '6 of 7 Above 20 DMA',
        sentiment: 'BULLISH',
        weight: 0.25,
        description: 'Breadth of top index constituents holding intermediate support',
      },
    ];
  }

  const { compositeScore, label, crowdRisk, crowdRiskDescription } = calculateSentimentComposite(metrics);

  return {
    symbolKey: symbol,
    compositeScore,
    label,
    crowdRisk,
    crowdRiskDescription,
    lastUpdated: Date.now(),
    metrics,
  };
}

/**
 * Applies a small stochastic tick drift to simulate real-time live updates
 */
export function tickDriftSentiment(prev: SentimentData): SentimentData {
  const updatedMetrics = prev.metrics.map((m) => {
    const delta = (Math.random() - 0.49) * 2.0; // slight random drift
    const newVal = Math.max(5, Math.min(95, Math.round(m.value + delta)));
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (newVal >= 58) sentiment = 'BULLISH';
    else if (newVal <= 42) sentiment = 'BEARISH';

    return {
      ...m,
      value: newVal,
      sentiment,
    };
  });

  const { compositeScore, label, crowdRisk, crowdRiskDescription } = calculateSentimentComposite(updatedMetrics);

  return {
    ...prev,
    compositeScore,
    label,
    crowdRisk,
    crowdRiskDescription,
    lastUpdated: Date.now(),
    metrics: updatedMetrics,
  };
}
