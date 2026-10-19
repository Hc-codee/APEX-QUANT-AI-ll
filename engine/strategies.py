"""
Asset-Specific Quantitative Strategy Rules for HC-NEXUS QUANT AI V1.0.
Specialized logic for Gold (XAUUSD), Bitcoin (BTCUSD), and NASDAQ CFD (US100/NAS100).
"""

from typing import Dict, Any, Tuple
from datetime import datetime, timezone
from .regimes import MarketRegime


class AssetStrategyBase:
    def __init__(self, symbol_key: str):
        self.symbol_key = symbol_key

    def check_session_active(self, timestamp: float) -> Tuple[bool, str]:
        raise NotImplementedError

    def check_spread(self, spread_pips: float) -> Tuple[bool, str]:
        raise NotImplementedError

    def compute_sl_tp(
        self,
        entry_price: float,
        direction: str,
        atr: float,
        pip_size: float
    ) -> Tuple[float, float]:
        raise NotImplementedError


class GoldStrategy(AssetStrategyBase):
    """
    XAUUSD Strategy: London & NY session momentum, strict spread cap, macroeconomic volatility filters.
    """

    def __init__(self, max_spread_pips: float = 3.5):
        super().__init__("XAUUSD")
        self.max_spread_pips = max_spread_pips

    def check_session_active(self, timestamp: float) -> Tuple[bool, str]:
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        # Avoid rollover spread blowup (21:00 - 23:00 UTC)
        if 21 <= dt.hour < 23:
            return False, f"Gold session filter: NY close rollover period ({dt.hour:02d}:{dt.minute:02d} UTC) spreads widen"
        # Friday afternoon exit (after 20:00 UTC Friday)
        if dt.weekday() == 4 and dt.hour >= 20:
            return False, "Gold session filter: Friday pre-weekend market closure approaching"
        # Weekend
        if dt.weekday() in (5, 6):
            return False, "Gold market is closed over the weekend"
        return True, "Gold active trading session"

    def check_spread(self, spread_pips: float) -> Tuple[bool, str]:
        if spread_pips > self.max_spread_pips:
            return False, f"Gold spread {spread_pips:.1f} pips exceeds limit of {self.max_spread_pips:.1f} pips"
        return True, "Spread within acceptable threshold"

    def compute_sl_tp(
        self,
        entry_price: float,
        direction: str,
        atr: float,
        pip_size: float
    ) -> Tuple[float, float]:
        # Volatility-based stops: SL = 2.0 * ATR, TP = 3.0 * ATR (1:1.5 R:R)
        sl_distance = max(atr * 2.0, pip_size * 25.0)  # at least $2.50 on Gold
        tp_distance = sl_distance * 1.5

        if direction == "BUY":
            sl = round(entry_price - sl_distance, 2)
            tp = round(entry_price + tp_distance, 2)
        else:
            sl = round(entry_price + sl_distance, 2)
            tp = round(entry_price - tp_distance, 2)

        return sl, tp


class BitcoinStrategy(AssetStrategyBase):
    """
    BTCUSD Strategy: 24/7 continuous operation, breakout and mean-reversion, liquidity check.
    """

    def __init__(self, max_spread_pips: float = 35.0):
        super().__init__("BTCUSD")
        self.max_spread_pips = max_spread_pips

    def check_session_active(self, timestamp: float) -> Tuple[bool, str]:
        # Bitcoin trades 24/7, but warn during Sunday 23:00 UTC weekly candle close
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        if dt.weekday() == 6 and dt.hour == 23 and dt.minute > 45:
            return False, "BTC weekly candle close rollover - high slippage probability"
        return True, "Bitcoin 24/7 crypto session active"

    def check_spread(self, spread_pips: float) -> Tuple[bool, str]:
        if spread_pips > self.max_spread_pips:
            return False, f"BTC spread ${spread_pips:.1f} exceeds limit of ${self.max_spread_pips:.1f}"
        return True, "BTC spread valid"

    def compute_sl_tp(
        self,
        entry_price: float,
        direction: str,
        atr: float,
        pip_size: float
    ) -> Tuple[float, float]:
        sl_distance = max(atr * 2.2, 250.0)  # at least $250 on BTC
        tp_distance = sl_distance * 1.6

        if direction == "BUY":
            sl = round(entry_price - sl_distance, 2)
            tp = round(entry_price + tp_distance, 2)
        else:
            sl = round(entry_price + sl_distance, 2)
            tp = round(entry_price - tp_distance, 2)

        return sl, tp


class NasdaqStrategy(AssetStrategyBase):
    """
    NASDAQ (US100 / NAS100) Strategy: US Equity Cash Session alignment, opening whipsaw filter.
    """

    def __init__(self, max_spread_pips: float = 2.5):
        super().__init__("NASDAQ")
        self.max_spread_pips = max_spread_pips

    def check_session_active(self, timestamp: float) -> Tuple[bool, str]:
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        # Avoid weekends
        if dt.weekday() in (5, 6):
            return False, "US Index CFD markets closed on weekends"

        # US Cash Session is 13:30 to 20:00 UTC (9:30 AM to 4:00 PM EST)
        # Avoid first 10 minutes of US open (13:30 - 13:40) due to unmodeled opening volatility
        if dt.hour == 13 and dt.minute < 40:
            return False, "NASDAQ filter: First 10 minutes of US market cash open (whipsaw filter active)"

        if dt.hour < 12 or dt.hour > 21:
            return False, f"Outside main NASDAQ liquid hours ({dt.hour:02d}:{dt.minute:02d} UTC, active window 12:00-21:00 UTC)"

        return True, "NASDAQ liquid session active"

    def check_spread(self, spread_pips: float) -> Tuple[bool, str]:
        if spread_pips > self.max_spread_pips:
            return False, f"NASDAQ spread {spread_pips:.1f} pts exceeds limit of {self.max_spread_pips:.1f} pts"
        return True, "NASDAQ spread within limit"

    def compute_sl_tp(
        self,
        entry_price: float,
        direction: str,
        atr: float,
        pip_size: float
    ) -> Tuple[float, float]:
        sl_distance = max(atr * 2.0, 30.0)  # at least 30 index points
        tp_distance = sl_distance * 1.5

        if direction == "BUY":
            sl = round(entry_price - sl_distance, 2)
            tp = round(entry_price + tp_distance, 2)
        else:
            sl = round(entry_price + sl_distance, 2)
            tp = round(entry_price - tp_distance, 2)

        return sl, tp
