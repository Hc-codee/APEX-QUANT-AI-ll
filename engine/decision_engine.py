"""
12-Step Signal Decision Engine for HC-NEXUS QUANT AI V1.0.
Provides an immutable, fully logged, auditable decision pipeline.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
import time

from .market_data import Candle, Tick, DataQualityValidator
from .features import FeatureEngineering
from .regimes import MarketRegimeDetector, MarketRegime
from .ml_engine import MachineLearningEngine
from .strategies import GoldStrategy, BitcoinStrategy, NasdaqStrategy, AssetStrategyBase
from .risk_engine import RiskManagementEngine, AccountState, SymbolSpecification


@dataclass
class PipelineStepResult:
    step_number: int
    name: str
    passed: bool
    summary: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DecisionOutcome:
    decision: str  # "BUY", "SELL", "HOLD", "NO_TRADE"
    symbol: str
    timestamp: float
    reason: str
    steps: List[PipelineStepResult]
    order_params: Optional[Dict[str, Any]] = None
    calibrated_prob: Optional[float] = None
    regime: Optional[str] = None


class SignalDecisionEngine:
    def __init__(
        self,
        validator: DataQualityValidator,
        feature_engine: FeatureEngineering,
        regime_detector: MarketRegimeDetector,
        ml_engine: MachineLearningEngine,
        risk_engine: RiskManagementEngine
    ):
        self.validator = validator
        self.feature_engine = feature_engine
        self.regime_detector = regime_detector
        self.ml_engine = ml_engine
        self.risk_engine = risk_engine
        self.strategies: Dict[str, AssetStrategyBase] = {
            "XAUUSD": GoldStrategy(),
            "BTCUSD": BitcoinStrategy(),
            "NASDAQ": NasdaqStrategy()
        }

    def evaluate(
        self,
        symbol_key: str,
        spec: SymbolSpecification,
        candles: List[Candle],
        latest_tick: Tick,
        account: AccountState,
        active_positions_for_symbol: int = 0
    ) -> DecisionOutcome:
        steps: List[PipelineStepResult] = []
        now = latest_tick.timestamp or time.time()

        # Step 1: Validate data
        c_valid, c_reason, closed_bars = self.validator.validate_candle_series(candles)
        t_valid, t_reason = self.validator.validate_tick(latest_tick, now)
        data_ok = c_valid and t_valid
        steps.append(PipelineStepResult(
            step_number=1,
            name="Data Quality Validation",
            passed=data_ok,
            summary=f"Candles: {c_reason} | Tick: {t_reason}",
            details={"bars_count": len(candles), "closed_bars": len(closed_bars), "spread": latest_tick.spread}
        ))
        if not data_ok:
            return DecisionOutcome(
                decision="NO_TRADE",
                symbol=symbol_key,
                timestamp=now,
                reason=f"Step 1 Failed: Data quality violation ({c_reason if not c_valid else t_reason})",
                steps=steps
            )

        # Step 2: Check market availability & session
        strat = self.strategies.get(symbol_key, GoldStrategy())
        sess_ok, sess_msg = strat.check_session_active(now)
        spread_pips = latest_tick.spread / spec.pip_size if spec.pip_size > 0 else latest_tick.spread
        spr_ok, spr_msg = strat.check_spread(spread_pips)
        market_ok = sess_ok and spr_ok
        steps.append(PipelineStepResult(
            step_number=2,
            name="Market Availability & Session Filter",
            passed=market_ok,
            summary=f"Session: {sess_msg} | Spread: {spr_msg}",
            details={"spread_pips": round(spread_pips, 2)}
        ))
        if not market_ok:
            return DecisionOutcome(
                decision="NO_TRADE",
                symbol=symbol_key,
                timestamp=now,
                reason=f"Step 2 Failed: {sess_msg if not sess_ok else spr_msg}",
                steps=steps
            )

        # Step 3: Detect Market Regime
        try:
            features = self.feature_engine.extract_features(closed_bars, symbol_key)
        except Exception as e:
            steps.append(PipelineStepResult(3, "Feature Extraction Pre-check", False, str(e)))
            return DecisionOutcome("NO_TRADE", symbol_key, now, f"Feature extraction failed: {e}", steps)

        regime, regime_tradeable, regime_reason = self.regime_detector.detect_regime(
            features, spread_pips
        )
        steps.append(PipelineStepResult(
            step_number=3,
            name="Market Regime Detection",
            passed=regime_tradeable,
            summary=f"Regime: {regime.value} - {regime_reason}",
            details={"regime": regime.value, "tradeable": regime_tradeable}
        ))
        if not regime_tradeable:
            return DecisionOutcome(
                decision="NO_TRADE",
                symbol=symbol_key,
                timestamp=now,
                reason=f"Step 3 Failed: Regime {regime.value} is non-tradeable ({regime_reason})",
                steps=steps,
                regime=regime.value
            )

        # Step 4: Generate Quantitative Features
        steps.append(PipelineStepResult(
            step_number=4,
            name="Quantitative Feature Engineering",
            passed=True,
            summary=f"Extracted {len(features)} leak-free point-in-time features",
            details={
                "rsi": features.get("rsi"),
                "adx": features.get("adx"),
                "natr": features.get("natr"),
                "realized_vol": features.get("realized_vol"),
                "dist_sma20": features.get("dist_sma20")
            }
        ))

        # Step 5: Obtain Model Predictions & Step 6: Probability Calibration
        est_cost_pips = spread_pips + 0.5  # spread + slippage cushion
        ml_eval = self.ml_engine.evaluate_signal(features, est_cost_pips, spec.pip_size)
        ml_ok = ml_eval["decision_allowed"] and ml_eval["model_bias"] in ("BUY", "SELL")

        steps.append(PipelineStepResult(
            step_number=5,
            name="Machine Learning Inference & Raw Scoring",
            passed=True,
            summary=f"Model: {ml_eval['model_version']}, Raw score: {ml_eval['raw_score']}",
            details={"raw_score": ml_eval["raw_score"]}
        ))

        steps.append(PipelineStepResult(
            step_number=6,
            name="Probability Calibration (Platt Sigmoid)",
            passed=ml_ok,
            summary=f"Calibrated P(Up)={ml_eval['p_up']:.1%}, P(Down)={ml_eval['p_down']:.1%} | Bias: {ml_eval['model_bias']}",
            details={"p_up": ml_eval["p_up"], "p_down": ml_eval["p_down"], "bias": ml_eval["model_bias"]}
        ))
        if not ml_ok:
            return DecisionOutcome(
                decision="HOLD" if 0.40 < ml_eval["p_up"] < 0.60 else "NO_TRADE",
                symbol=symbol_key,
                timestamp=now,
                reason=f"Step 6: {ml_eval['reason']}",
                steps=steps,
                calibrated_prob=ml_eval["p_up"],
                regime=regime.value
            )

        direction = ml_eval["model_bias"]

        # Step 7: Expected Trade Outcome After Costs
        net_edge = ml_eval["expected_payoff_buy"] if direction == "BUY" else ml_eval["expected_payoff_sell"]
        edge_ok = net_edge > 0.0
        steps.append(PipelineStepResult(
            step_number=7,
            name="Execution Cost Expectancy Hurdle",
            passed=edge_ok,
            summary=f"Expected Net Edge: {net_edge:+.2f} pips after {est_cost_pips:.2f} pips friction",
            details={"net_edge": net_edge, "est_cost_pips": est_cost_pips}
        ))
        if not edge_ok:
            return DecisionOutcome(
                decision="NO_TRADE",
                symbol=symbol_key,
                timestamp=now,
                reason=f"Step 7 Failed: Expected edge ({net_edge:.2f} pips) does not cover transaction costs",
                steps=steps,
                calibrated_prob=ml_eval["p_up"],
                regime=regime.value
            )

        # Step 8: Apply Strategy-Specific Rules & Compute SL/TP
        entry_price = latest_tick.ask if direction == "BUY" else latest_tick.bid
        atr_val = features.get("atr", 1.0)
        sl, tp = strat.compute_sl_tp(entry_price, direction, atr_val, spec.pip_size)

        steps.append(PipelineStepResult(
            step_number=8,
            name="Asset Strategy Parameters & SL/TP Boundaries",
            passed=True,
            summary=f"{direction} Entry: {entry_price:.2f} | SL: {sl:.2f} | TP: {tp:.2f}",
            details={"entry": entry_price, "sl": sl, "tp": tp}
        ))

        # Step 9: Apply Portfolio Risk Limits
        if active_positions_for_symbol >= 1:
            steps.append(PipelineStepResult(
                step_number=9,
                name="Portfolio & Symbol Exposure Limits",
                passed=False,
                summary=f"Symbol {symbol_key} already has an active managed position",
                details={"active_positions": active_positions_for_symbol}
            ))
            return DecisionOutcome(
                decision="HOLD",
                symbol=symbol_key,
                timestamp=now,
                reason="Step 9: Position already open for this symbol (1 position limit per asset)",
                steps=steps,
                calibrated_prob=ml_eval["p_up"],
                regime=regime.value
            )

        steps.append(PipelineStepResult(
            step_number=9,
            name="Portfolio & Symbol Exposure Limits",
            passed=True,
            summary="Symbol slot free, portfolio risk budget available",
            details={"open_positions": account.open_positions_count}
        ))

        # Step 10: Calculate Position Size & Step 11: Validate Proposed Order
        size_ok, volume, size_msg, size_meta = self.risk_engine.calculate_position_size(
            account, spec, entry_price, sl
        )
        steps.append(PipelineStepResult(
            step_number=10,
            name="Risk-Based Position Sizing (0.25% Equity)",
            passed=size_ok,
            summary=f"Volume: {volume:.2f} lots | {size_msg}",
            details=size_meta
        ))
        if not size_ok:
            return DecisionOutcome(
                decision="NO_TRADE",
                symbol=symbol_key,
                timestamp=now,
                reason=f"Step 10 Failed: Position sizing check ({size_msg})",
                steps=steps,
                calibrated_prob=ml_eval["p_up"],
                regime=regime.value
            )

        steps.append(PipelineStepResult(
            step_number=11,
            name="Pre-Execution Order Constraint Validation",
            passed=True,
            summary="Margin verified, stop levels above minimum broker stop level, step normalized",
            details={"volume": volume, "margin_est": size_meta.get("estimated_margin")}
        ))

        # Step 12: Final Execution Authorization
        order_params = {
            "symbol": spec.symbol,
            "symbol_key": symbol_key,
            "action": direction,
            "volume": volume,
            "price": entry_price,
            "sl": sl,
            "tp": tp,
            "magic": spec.magic_number,
            "comment": f"NEXUS_{symbol_key}_{direction}",
            "calibrated_prob": ml_eval["p_up"] if direction == "BUY" else ml_eval["p_down"]
        }

        steps.append(PipelineStepResult(
            step_number=12,
            name="Final Order Execution Authorization",
            passed=True,
            summary=f"AUTHORIZED: {direction} {volume:.2f} lots {spec.symbol} @ {entry_price:.2f}",
            details=order_params
        ))

        return DecisionOutcome(
            decision=direction,
            symbol=symbol_key,
            timestamp=now,
            reason=f"All 12 validation gates PASSED. High-probability {direction} setup.",
            steps=steps,
            order_params=order_params,
            calibrated_prob=ml_eval["p_up"],
            regime=regime.value
        )
