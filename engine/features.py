"""
Feature Engineering module for HC-NEXUS QUANT AI V1.0.
Calculates leak-free quantitative indicators from strictly completed candle sequences.
"""

from typing import List, Dict, Any, Optional
import math
from datetime import datetime, timezone
from .market_data import Candle


def calculate_sma(values: List[float], period: int) -> List[float]:
    if len(values) < period:
        return [0.0] * len(values)
    sma = []
    window_sum = sum(values[:period])
    sma.extend([0.0] * (period - 1))
    sma.append(window_sum / period)
    for i in range(period, len(values)):
        window_sum += values[i] - values[i - period]
        sma.append(window_sum / period)
    return sma


def calculate_ema(values: List[float], period: int) -> List[float]:
    if len(values) < period:
        return [0.0] * len(values)
    ema = [0.0] * (period - 1)
    k = 2.0 / (period + 1)
    initial_sma = sum(values[:period]) / period
    ema.append(initial_sma)
    for i in range(period, len(values)):
        val = values[i] * k + ema[-1] * (1.0 - k)
        ema.append(val)
    return ema


def calculate_atr(candles: List[Candle], period: int = 14) -> List[float]:
    if len(candles) < period + 1:
        return [0.0] * len(candles)

    true_ranges = [candles[0].high - candles[0].low]
    for i in range(1, len(candles)):
        c_prev = candles[i - 1].close
        tr = max(
            candles[i].high - candles[i].low,
            abs(candles[i].high - c_prev),
            abs(candles[i].low - c_prev)
        )
        true_ranges.append(tr)

    # Wilder's smoothing
    atr = [0.0] * (period - 1)
    first_atr = sum(true_ranges[:period]) / period
    atr.append(first_atr)

    for i in range(period, len(true_ranges)):
        current_atr = (atr[-1] * (period - 1) + true_ranges[i]) / period
        atr.append(current_atr)

    return atr


def calculate_rsi(closes: List[float], period: int = 14) -> List[float]:
    if len(closes) < period + 1:
        return [50.0] * len(closes)

    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))

    rsi = [50.0] * period
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    if avg_loss == 0:
        rsi.append(100.0)
    else:
        rs = avg_gain / avg_loss
        rsi.append(100.0 - (100.0 / (1.0 + rs)))

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            rsi.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi.append(100.0 - (100.0 / (1.0 + rs)))

    return rsi


def calculate_adx(candles: List[Candle], period: int = 14) -> List[float]:
    if len(candles) < period * 2:
        return [20.0] * len(candles)

    # Simplified Wilder ADX
    tr_list = []
    plus_dm = []
    minus_dm = []

    for i in range(1, len(candles)):
        c_prev = candles[i - 1].close
        tr = max(candles[i].high - candles[i].low, abs(candles[i].high - c_prev), abs(candles[i].low - c_prev))
        tr_list.append(tr)

        up_move = candles[i].high - candles[i - 1].high
        down_move = candles[i - 1].low - candles[i].low

        if up_move > down_move and up_move > 0:
            plus_dm.append(up_move)
        else:
            plus_dm.append(0.0)

        if down_move > up_move and down_move > 0:
            minus_dm.append(down_move)
        else:
            minus_dm.append(0.0)

    # Smooth TR, +DM, -DM
    adx_out = [20.0] * len(candles)
    if len(tr_list) < period:
        return adx_out

    smooth_tr = sum(tr_list[:period])
    smooth_pdm = sum(plus_dm[:period])
    smooth_mdm = sum(minus_dm[:period])

    dx_list = []
    for i in range(period, len(tr_list)):
        smooth_tr = smooth_tr - (smooth_tr / period) + tr_list[i]
        smooth_pdm = smooth_pdm - (smooth_pdm / period) + plus_dm[i]
        smooth_mdm = smooth_mdm - (smooth_mdm / period) + minus_dm[i]

        pdi = 100 * (smooth_pdm / smooth_tr) if smooth_tr > 0 else 0
        mdi = 100 * (smooth_mdm / smooth_tr) if smooth_tr > 0 else 0
        di_sum = pdi + mdi
        dx = (100 * abs(pdi - mdi) / di_sum) if di_sum > 0 else 0
        dx_list.append(dx)

    if len(dx_list) >= period:
        curr_adx = sum(dx_list[:period]) / period
        # Pad up to start of adx
        offset = len(candles) - (len(dx_list) - period + 1)
        for idx in range(offset, len(candles)):
            curr_dx = dx_list[idx - offset + period - 1] if (idx - offset + period - 1) < len(dx_list) else dx_list[-1]
            curr_adx = (curr_adx * (period - 1) + curr_dx) / period
            adx_out[idx] = round(curr_adx, 2)

    return adx_out


class FeatureEngineering:
    """
    Transforms clean, closed bars into a structured, normalized quantitative feature vector.
    """

    def __init__(self, atr_period: int = 14, rsi_period: int = 14, adx_period: int = 14):
        self.atr_period = atr_period
        self.rsi_period = rsi_period
        self.adx_period = adx_period

    def extract_features(self, candles: List[Candle], symbol: str = "XAUUSD") -> Dict[str, float]:
        """
        Extracts point-in-time features using only information available up to bar [-1].
        """
        if len(candles) < 60:
            raise ValueError(f"Insufficient history for feature extraction: {len(candles)} bars (minimum 60 required)")

        closes = [c.close for c in candles]
        highs = [c.high for c in candles]
        lows = [c.low for c in candles]

        # Latest completed candle
        last_bar = candles[-1]
        c = last_bar.close

        # 1. Multi-horizon returns
        ret_1 = (c / closes[-2] - 1.0) if closes[-2] > 0 else 0.0
        ret_3 = (c / closes[-4] - 1.0) if len(closes) > 3 and closes[-4] > 0 else 0.0
        ret_5 = (c / closes[-6] - 1.0) if len(closes) > 5 and closes[-6] > 0 else 0.0
        ret_12 = (c / closes[-13] - 1.0) if len(closes) > 12 and closes[-13] > 0 else 0.0

        # 2. Moving Average relationships
        sma_20_list = calculate_sma(closes, 20)
        ema_50_list = calculate_ema(closes, 50)
        sma_20 = sma_20_list[-1]
        ema_50 = ema_50_list[-1]

        dist_sma20 = (c - sma_20) / sma_20 if sma_20 > 0 else 0.0
        dist_ema50 = (c - ema_50) / ema_50 if ema_50 > 0 else 0.0
        ma_cross = 1.0 if sma_20 > ema_50 else (-1.0 if sma_20 < ema_50 else 0.0)

        # 3. Volatility & ATR
        atr_list = calculate_atr(candles, self.atr_period)
        current_atr = atr_list[-1]
        natr = (current_atr / c) if c > 0 else 0.0

        # Realized volatility (std dev of last 20 returns)
        recent_log_returns = [math.log(closes[i] / closes[i - 1]) for i in range(len(closes) - 20, len(closes))]
        mean_ret = sum(recent_log_returns) / len(recent_log_returns)
        var = sum((r - mean_ret) ** 2 for r in recent_log_returns) / (len(recent_log_returns) - 1)
        realized_vol = math.sqrt(var) if var > 0 else 0.0

        # 4. Momentum & Oscillators
        rsi_list = calculate_rsi(closes, self.rsi_period)
        current_rsi = rsi_list[-1]
        adx_list = calculate_adx(candles, self.adx_period)
        current_adx = adx_list[-1]

        # 5. Price Action / Candle Microstructure
        candle_range = last_bar.high - last_bar.low
        if candle_range > 0:
            body = abs(last_bar.close - last_bar.open)
            upper_wick = last_bar.high - max(last_bar.open, last_bar.close)
            lower_wick = min(last_bar.open, last_bar.close) - last_bar.low
            body_ratio = body / candle_range
            upper_wick_ratio = upper_wick / candle_range
            lower_wick_ratio = lower_wick / candle_range
        else:
            body_ratio, upper_wick_ratio, lower_wick_ratio = 1.0, 0.0, 0.0

        # 6. Breakout Proximity (distance to 20-bar Donchian channel)
        high_20 = max(highs[-21:-1]) if len(highs) >= 21 else highs[-1]
        low_20 = min(lows[-21:-1]) if len(lows) >= 21 else lows[-1]
        range_20 = high_20 - low_20
        donchian_pos = (c - low_20) / range_20 if range_20 > 0 else 0.5

        # 7. Time / Session cyclics
        # UTC hour cyclic encoding
        dt = datetime.fromtimestamp(last_bar.timestamp, tz=timezone.utc)
        hour = dt.hour + dt.minute / 60.0
        hour_sin = math.sin(2 * math.pi * hour / 24.0)
        hour_cos = math.cos(2 * math.pi * hour / 24.0)
        day_of_week = float(dt.weekday())

        return {
            "ret_1": round(ret_1, 6),
            "ret_3": round(ret_3, 6),
            "ret_5": round(ret_5, 6),
            "ret_12": round(ret_12, 6),
            "dist_sma20": round(dist_sma20, 6),
            "dist_ema50": round(dist_ema50, 6),
            "ma_cross": ma_cross,
            "atr": round(current_atr, 4),
            "natr": round(natr, 6),
            "realized_vol": round(realized_vol, 6),
            "rsi": round(current_rsi, 2),
            "adx": round(current_adx, 2),
            "body_ratio": round(body_ratio, 4),
            "upper_wick_ratio": round(upper_wick_ratio, 4),
            "lower_wick_ratio": round(lower_wick_ratio, 4),
            "donchian_pos": round(donchian_pos, 4),
            "hour_sin": round(hour_sin, 4),
            "hour_cos": round(hour_cos, 4),
            "day_of_week": day_of_week,
        }
