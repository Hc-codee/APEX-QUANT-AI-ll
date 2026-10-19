"""
Market Regime Detection for HC-NEXUS QUANT AI V1.0.
Classifies macro and micro regimes to avoid operating out-of-distribution.
"""

from enum import Enum
from typing import Dict, Any, Tuple


class MarketRegime(str, Enum):
    TRENDING_BULL = "TRENDING_BULL"
    TRENDING_BEAR = "TRENDING_BEAR"
    RANGING_LOW_VOL = "RANGING_LOW_VOL"
    RANGING_HIGH_VOL = "RANGING_HIGH_VOL"
    VOLATILITY_EXPANSION = "VOLATILITY_EXPANSION"
    ABNORMAL_UNRELIABLE = "ABNORMAL_UNRELIABLE"


class MarketRegimeDetector:
    """
    Evaluates ADX, ATR percentile, Moving Average slope, and wick noise
    to classify the current operating regime and determine if trading is permissible.
    """

    def __init__(self, adx_trend_threshold: float = 25.0, high_vol_multiplier: float = 1.8):
        self.adx_trend_threshold = adx_trend_threshold
        self.high_vol_multiplier = high_vol_multiplier

    def detect_regime(
        self,
        features: Dict[str, float],
        spread_pips: float,
        max_allowed_spread_pips: float = 4.0
    ) -> Tuple[MarketRegime, bool, str]:
        """
        Returns:
            - Detected MarketRegime enum
            - is_tradeable (boolean)
            - descriptive rationale
        """
        # 1. Abnormal checks (spread blowup, extreme volatility)
        if spread_pips > max_allowed_spread_pips:
            return (
                MarketRegime.ABNORMAL_UNRELIABLE,
                False,
                f"Spread widened to {spread_pips:.1f} pips > {max_allowed_spread_pips:.1f} limit (news or low liquidity)"
            )

        if features.get("realized_vol", 0.0) > 0.04:  # > 4% bar-to-bar volatility
            return (
                MarketRegime.ABNORMAL_UNRELIABLE,
                False,
                f"Extreme realized volatility spike ({features['realized_vol']:.4f}) - market unstable"
            )

        adx = features.get("adx", 20.0)
        dist_sma20 = features.get("dist_sma20", 0.0)
        dist_ema50 = features.get("dist_ema50", 0.0)
        donchian = features.get("donchian_pos", 0.5)
        natr = features.get("natr", 0.005)

        # 2. Breakout / Volatility expansion
        if (donchian > 0.95 or donchian < 0.05) and adx > 22.0:
            return (
                MarketRegime.VOLATILITY_EXPANSION,
                True,
                "Donchian 20-period boundary pierced with rising ADX momentum"
            )

        # 3. Trending Regimes
        if adx >= self.adx_trend_threshold:
            if dist_sma20 > 0.001 and dist_ema50 > 0.001:
                return (
                    MarketRegime.TRENDING_BULL,
                    True,
                    f"Strong bullish trend: ADX={adx:.1f}, price above SMA20 & EMA50"
                )
            elif dist_sma20 < -0.001 and dist_ema50 < -0.001:
                return (
                    MarketRegime.TRENDING_BEAR,
                    True,
                    f"Strong bearish trend: ADX={adx:.1f}, price below SMA20 & EMA50"
                )

        # 4. Ranging / Consolidation
        if natr > 0.012:
            return (
                MarketRegime.RANGING_HIGH_VOL,
                False,  # High-vol choppy ranges have poor risk/reward for trend models
                f"Choppy high-volatility range (ADX={adx:.1f}, NATR={natr:.4f})"
            )

        return (
            MarketRegime.RANGING_LOW_VOL,
            True,
            f"Equilibrium range: ADX={adx:.1f}, NATR={natr:.4f}"
        )
