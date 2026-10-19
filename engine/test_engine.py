"""
Automated unit test suite for HC-NEXUS QUANT AI V1.0 Python Engine.
Tests data validation, feature extraction, probability calibration, risk sizing, and regimes.
"""

import unittest
import math
import time

from engine.market_data import Candle, Tick, DataQualityValidator
from engine.features import FeatureEngineering, calculate_atr, calculate_rsi
from engine.regimes import MarketRegimeDetector, MarketRegime
from engine.risk_engine import RiskManagementEngine, AccountState, SymbolSpecification
from engine.ml_engine import CalibratedProbabilityModel, MachineLearningEngine, calculate_brier_score


class TestQuantEngine(unittest.TestCase):

    def setUp(self):
        self.validator = DataQualityValidator(max_stale_seconds=5.0)
        self.feature_engine = FeatureEngineering()
        self.regime_detector = MarketRegimeDetector()
        self.risk_engine = RiskManagementEngine()

        # Generate 100 synthetic sequential M15 candles for Gold
        self.candles = []
        base_price = 2700.0
        start_ts = 1700000000.0

        for i in range(100):
            # Deterministic walk
            c_open = base_price + math.sin(i * 0.1) * 15.0 + (i * 0.2)
            c_high = c_open + 3.0 + abs(math.cos(i))
            c_low = c_open - 3.0 - abs(math.sin(i))
            c_close = (c_high + c_low) / 2.0 + (math.sin(i) * 1.5)
            self.candles.append(Candle(
                timestamp=start_ts + (i * 900),
                open=round(c_open, 2),
                high=round(c_high, 2),
                low=round(c_low, 2),
                close=round(c_close, 2),
                volume=150.0 + (i % 20),
                is_complete=True
            ))

    def test_candle_validation(self):
        ok, msg, clean = self.validator.validate_candle_series(self.candles)
        self.assertTrue(ok)
        self.assertEqual(len(clean), 100)

        # Inverted bar test
        bad_bar = Candle(timestamp=2000, open=100, high=90, low=110, close=95, volume=10)
        ok_bad, _ = bad_bar.validate()
        self.assertFalse(ok_bad)

    def test_tick_validation_and_stale_rejection(self):
        now = time.time()
        fresh_tick = Tick(timestamp=now, bid=2720.0, ask=2720.3, last=2720.1, volume=5)
        ok, msg = self.validator.validate_tick(fresh_tick, now)
        self.assertTrue(ok)

        # Stale tick (> 5s)
        stale_tick = Tick(timestamp=now - 20.0, bid=2720.0, ask=2720.3, last=2720.1, volume=5)
        ok_stale, msg_stale = self.validator.validate_tick(stale_tick, now)
        self.assertFalse(ok_stale)
        self.assertIn("Stale tick", msg_stale)

    def test_feature_extraction(self):
        features = self.feature_engine.extract_features(self.candles, "XAUUSD")
        self.assertIn("rsi", features)
        self.assertIn("adx", features)
        self.assertIn("atr", features)
        self.assertIn("dist_sma20", features)
        self.assertTrue(0 <= features["rsi"] <= 100)
        self.assertGreater(features["atr"], 0)

    def test_risk_position_sizing(self):
        account = AccountState(
            balance=10000.0,
            equity=10000.0,
            free_margin=10000.0,
            margin_used=0.0,
            daily_start_equity=10000.0,
            current_daily_drawdown_pct=0.0,
            open_positions_count=0
        )
        gold_spec = SymbolSpecification(
            symbol="XAUUSD",
            contract_size=100.0,
            pip_size=0.1,
            volume_min=0.01,
            volume_max=20.0,
            volume_step=0.01,
            digits=2,
            magic_number=881001
        )

        entry = 2720.0
        sl = 2710.0  # $10 stop = 100 pips
        ok, vol, msg, meta = self.risk_engine.calculate_position_size(account, gold_spec, entry, sl)
        self.assertTrue(ok)
        # Risk = 10000 * 0.0025 = $25. Loss per lot = $10 * 100 = $1000. Volume = 25 / 1000 = 0.025 -> rounded down to 0.02 lots
        self.assertEqual(vol, 0.02)
        self.assertLessEqual(meta["actual_monetary_risk"], 25.0)

    def test_daily_loss_limit_circuit_breaker(self):
        # 1.5% drawdown on 1.0% limit -> Reject
        breached_account = AccountState(
            balance=9850.0,
            equity=9850.0,
            free_margin=9850.0,
            margin_used=0.0,
            daily_start_equity=10000.0,
            current_daily_drawdown_pct=1.5,
            open_positions_count=0
        )
        ok, msg = self.risk_engine.validate_account_for_trading(breached_account)
        self.assertFalse(ok)
        self.assertIn("Daily loss limit breached", msg)

    def test_probability_calibration_and_brier(self):
        model = CalibratedProbabilityModel()
        features = {
            "dist_sma20": 0.005,
            "dist_ema50": 0.008,
            "natr": 0.003,
            "rsi": 58.0,
            "adx": 28.0,
            "body_ratio": 0.7,
            "donchian_pos": 0.85,
            "ret_3": 0.004
        }
        p_up, p_down, raw = model.predict_probability(features)
        self.assertTrue(0.0 <= p_up <= 1.0)
        self.assertTrue(0.0 <= p_down <= 1.0)
        self.assertAlmostEqual(p_up + p_down, 1.0, places=3)

        # Test Brier Score
        preds = [0.8, 0.7, 0.3, 0.2]
        outcomes = [1, 1, 0, 0]
        brier = calculate_brier_score(preds, outcomes)
        self.assertLess(brier, 0.1)


if __name__ == "__main__":
    unittest.main()
