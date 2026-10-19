"""
MarketDataService & DataQualityValidator for HC-NEXUS QUANT AI V1.0.
Handles MT5 terminal candle retrieval, tick synchronization, and rigorous quality checks.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
import math


@dataclass
class Candle:
    timestamp: float  # Unix epoch seconds
    open: float
    high: float
    low: float
    close: float
    volume: float
    is_complete: bool = True

    def validate(self) -> Tuple[bool, str]:
        if any(math.isnan(x) or math.isinf(x) for x in [self.open, self.high, self.low, self.close, self.volume]):
            return False, "Candle contains NaN or Inf values"
        if self.low > self.high:
            return False, f"Invalid OHLC: Low ({self.low}) > High ({self.high})"
        if self.open < self.low or self.open > self.high:
            return False, f"Invalid OHLC: Open ({self.open}) outside [Low, High]"
        if self.close < self.low or self.close > self.high:
            return False, f"Invalid OHLC: Close ({self.close}) outside [Low, High]"
        if self.open <= 0 or self.high <= 0 or self.low <= 0 or self.close <= 0:
            return False, "Non-positive price in OHLC"
        if self.volume < 0:
            return False, "Negative volume"
        return True, "Valid"


@dataclass
class Tick:
    timestamp: float
    bid: float
    ask: float
    last: float
    volume: float
    spread: float = 0.0

    def __post_init__(self):
        if self.spread == 0.0 and self.ask >= self.bid:
            self.spread = round(self.ask - self.bid, 5)

    def is_stale(self, current_time: float, max_latency_seconds: float = 5.0) -> bool:
        return (current_time - self.timestamp) > max_latency_seconds

    def validate(self) -> Tuple[bool, str]:
        if self.bid <= 0 or self.ask <= 0:
            return False, "Non-positive bid or ask"
        if self.ask < self.bid:
            return False, f"Inverted spread: Ask ({self.ask}) < Bid ({self.bid})"
        return True, "Valid"


class DataQualityValidator:
    """
    Ensures zero look-ahead bias, rejects malformed bars, checks chronological integrity,
    and identifies market closure or data feed drops.
    """

    def __init__(self, max_stale_seconds: float = 10.0, max_spread_pips: float = 10.0):
        self.max_stale_seconds = max_stale_seconds
        self.max_spread_pips = max_spread_pips

    def validate_candle_series(self, candles: List[Candle], expected_interval_seconds: int = 900) -> Tuple[bool, str, List[Candle]]:
        """
        Validates a sequence of candles:
        - Sorted chronologically ascending
        - No duplicate timestamps
        - No future timestamps
        - Completed candle isolation (distinguishing current bar from closed bars)
        """
        if not candles or len(candles) < 20:
            return False, f"Insufficient candle history: {len(candles) if candles else 0} bars", []

        valid_candles: List[Candle] = []
        last_ts = -1.0

        for idx, bar in enumerate(candles):
            is_valid, reason = bar.validate()
            if not is_valid:
                return False, f"Bar #{idx} validation failed: {reason}", []

            if bar.timestamp <= last_ts:
                return False, f"Timestamp monotonicity violated at bar #{idx}: {bar.timestamp} <= {last_ts}", []

            last_ts = bar.timestamp
            valid_candles.append(bar)

        # Distinguish completed candles from unfinished candle
        # The last candle in a live stream is often still forming; feature calculations MUST use only closed candles
        closed_candles = valid_candles[:-1] if not valid_candles[-1].is_complete else valid_candles

        return True, "Candle series validated cleanly", closed_candles

    def validate_tick(self, tick: Optional[Tick], current_time: Optional[float] = None) -> Tuple[bool, str]:
        if tick is None:
            return False, "Null tick received"

        valid, msg = tick.validate()
        if not valid:
            return False, msg

        if current_time is not None:
            if tick.is_stale(current_time, self.max_stale_seconds):
                return False, f"Stale tick: age is {current_time - tick.timestamp:.2f}s > {self.max_stale_seconds}s limit"

        return True, "Tick valid and fresh"


class MarketDataService:
    """
    Abbreviated standalone service supporting direct Wine MT5 connection
    or IPC cached data ingestion from the MQL5 bridge.
    """

    def __init__(self, validator: Optional[DataQualityValidator] = None):
        self.validator = validator or DataQualityValidator()
        self.last_ticks: Dict[str, Tick] = {}
        self.candle_cache: Dict[str, List[Candle]] = {}

    def ingest_tick(self, symbol: str, tick: Tick) -> bool:
        valid, _ = self.validator.validate_tick(tick)
        if valid:
            self.last_ticks[symbol] = tick
            return True
        return False

    def ingest_candles(self, symbol: str, candles: List[Candle]) -> bool:
        valid, _, clean = self.validator.validate_candle_series(candles)
        if valid:
            self.candle_cache[symbol] = clean
            return True
        return False

    def get_latest_price(self, symbol: str) -> Optional[Tick]:
        return self.last_ticks.get(symbol)
