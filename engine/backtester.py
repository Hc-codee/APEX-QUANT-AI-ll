"""
Backtesting & Walk-Forward Validation Engine for HC-NEXUS QUANT AI V1.0.
Strictly sequential, leak-free historical simulation with realistic transaction friction.
"""

from typing import List, Dict, Any, Tuple
import math
from .market_data import Candle, Tick
from .features import FeatureEngineering
from .regimes import MarketRegimeDetector
from .ml_engine import MachineLearningEngine
from .risk_engine import RiskManagementEngine, AccountState, SymbolSpecification
from .decision_engine import SignalDecisionEngine


class BacktestReport:
    def __init__(self, trades: List[Dict[str, Any]], initial_capital: float = 10000.0):
        self.trades = trades
        self.initial_capital = initial_capital
        self.equity_curve: List[Dict[str, Any]] = []
        self.stats: Dict[str, Any] = {}
        self._calculate_metrics()

    def _calculate_metrics(self):
        curr_equity = self.initial_capital
        peak_equity = self.initial_capital
        max_dd_amount = 0.0
        max_dd_pct = 0.0

        self.equity_curve.append({
            "trade_idx": 0,
            "timestamp": self.trades[0]["exit_time"] if self.trades else 0,
            "equity": round(curr_equity, 2),
            "drawdown_pct": 0.0
        })

        wins = []
        losses = []
        total_costs = 0.0

        for idx, t in enumerate(self.trades, 1):
            net_pnl = t["net_pnl"]
            total_costs += t.get("commission", 0.0) + t.get("spread_cost", 0.0) + t.get("slippage_cost", 0.0)

            curr_equity += net_pnl
            if curr_equity > peak_equity:
                peak_equity = curr_equity

            dd = peak_equity - curr_equity
            dd_pct = (dd / peak_equity) * 100 if peak_equity > 0 else 0
            if dd > max_dd_amount:
                max_dd_amount = dd
            if dd_pct > max_dd_pct:
                max_dd_pct = dd_pct

            if net_pnl > 0:
                wins.append(net_pnl)
            else:
                losses.append(net_pnl)

            self.equity_curve.append({
                "trade_idx": idx,
                "timestamp": t["exit_time"],
                "equity": round(curr_equity, 2),
                "drawdown_pct": round(dd_pct, 2)
            })

        total_trades = len(self.trades)
        win_count = len(wins)
        loss_count = len(losses)
        win_rate = (win_count / total_trades) * 100 if total_trades > 0 else 0.0

        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 1.0)

        net_profit = curr_equity - self.initial_capital
        net_return_pct = (net_profit / self.initial_capital) * 100

        avg_win = (sum(wins) / win_count) if win_count > 0 else 0.0
        avg_loss = (sum(losses) / loss_count) if loss_count > 0 else 0.0
        expectancy = (net_profit / total_trades) if total_trades > 0 else 0.0

        # Sharpe ratio calculation on trade returns
        returns = [t["net_pnl"] / self.initial_capital for t in self.trades]
        if len(returns) > 1:
            mean_ret = sum(returns) / len(returns)
            variance = sum((r - mean_ret) ** 2 for r in returns) / (len(returns) - 1)
            std_dev = math.sqrt(variance) if variance > 0 else 0.001
            sharpe = (mean_ret / std_dev) * math.sqrt(252) if std_dev > 0 else 0.0

            downside = [r for r in returns if r < 0]
            if downside:
                downside_var = sum(r ** 2 for r in downside) / len(downside)
                downside_std = math.sqrt(downside_var) if downside_var > 0 else 0.001
                sortino = (mean_ret / downside_std) * math.sqrt(252)
            else:
                sortino = sharpe * 1.5
        else:
            sharpe = 0.0
            sortino = 0.0

        self.stats = {
            "initial_capital": self.initial_capital,
            "final_equity": round(curr_equity, 2),
            "net_profit": round(net_profit, 2),
            "net_return_pct": round(net_return_pct, 2),
            "total_trades": total_trades,
            "win_rate_pct": round(win_rate, 2),
            "profit_factor": round(profit_factor, 2),
            "sharpe_ratio": round(sharpe, 2),
            "sortino_ratio": round(sortino, 2),
            "max_drawdown_pct": round(max_dd_pct, 2),
            "max_drawdown_amount": round(max_dd_amount, 2),
            "expectancy_per_trade": round(expectancy, 2),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "total_friction_costs": round(total_costs, 2),
            "win_count": win_count,
            "loss_count": loss_count
        }


class WalkForwardBacktester:
    """
    Simulates realistic bar-by-bar chronological execution.
    """

    def __init__(
        self,
        symbol_key: str,
        spec: SymbolSpecification,
        spread_pips: float = 2.0,
        slippage_pips: float = 0.5,
        commission_per_lot: float = 5.0
    ):
        self.symbol_key = symbol_key
        self.spec = spec
        self.spread_pips = spread_pips
        self.slippage_pips = slippage_pips
        self.commission_per_lot = commission_per_lot

    def run(
        self,
        candles: List[Candle],
        initial_capital: float = 10000.0,
        warmup_bars: int = 60
    ) -> BacktestReport:
        from .market_data import DataQualityValidator
        from .features import FeatureEngineering
        from .regimes import MarketRegimeDetector
        from .ml_engine import MachineLearningEngine
        from .risk_engine import RiskManagementEngine

        validator = DataQualityValidator()
        fe = FeatureEngineering()
        rd = MarketRegimeDetector()
        ml = MachineLearningEngine()
        risk = RiskManagementEngine()
        decision_engine = SignalDecisionEngine(validator, fe, rd, ml, risk)

        account = AccountState(
            balance=initial_capital,
            equity=initial_capital,
            free_margin=initial_capital,
            margin_used=0.0,
            daily_start_equity=initial_capital,
            current_daily_drawdown_pct=0.0,
            open_positions_count=0
        )

        open_position: Optional[Dict[str, Any]] = None
        closed_trades: List[Dict[str, Any]] = []

        spread_points = self.spread_pips * self.spec.pip_size
        slippage_points = self.slippage_pips * self.spec.pip_size

        for i in range(warmup_bars, len(candles)):
            curr_bar = candles[i]
            history = candles[:i]  # strictly up to previous bar, no future leak!

            # Check open position exits against curr_bar high/low
            if open_position is not None:
                action = open_position["action"]
                entry_p = open_position["entry_price"]
                sl = open_position["sl"]
                tp = open_position["tp"]
                vol = open_position["volume"]

                exit_triggered = False
                exit_price = 0.0
                exit_reason = ""

                if action == "BUY":
                    # Check SL hit first (conservative assumption)
                    if curr_bar.low <= sl:
                        exit_triggered = True
                        exit_price = sl - slippage_points
                        exit_reason = "STOP_LOSS"
                    elif curr_bar.high >= tp:
                        exit_triggered = True
                        exit_price = tp
                        exit_reason = "TAKE_PROFIT"
                else:  # SELL
                    if curr_bar.high >= sl:
                        exit_triggered = True
                        exit_price = sl + slippage_points
                        exit_reason = "STOP_LOSS"
                    elif curr_bar.low <= tp:
                        exit_triggered = True
                        exit_price = tp
                        exit_reason = "TAKE_PROFIT"

                if exit_triggered:
                    # Calculate net PnL
                    if action == "BUY":
                        gross_pnl = (exit_price - entry_p) * self.spec.contract_size * vol
                    else:
                        gross_pnl = (entry_p - exit_price) * self.spec.contract_size * vol

                    commission = self.commission_per_lot * vol
                    spread_cost = spread_points * self.spec.contract_size * vol
                    slippage_cost = slippage_points * self.spec.contract_size * vol
                    net_pnl = gross_pnl - commission

                    account.equity += net_pnl
                    account.balance += net_pnl
                    account.free_margin += net_pnl
                    account.open_positions_count = 0

                    closed_trades.append({
                        "symbol": self.symbol_key,
                        "action": action,
                        "volume": vol,
                        "entry_time": open_position["entry_time"],
                        "entry_price": entry_p,
                        "exit_time": curr_bar.timestamp,
                        "exit_price": exit_price,
                        "exit_reason": exit_reason,
                        "gross_pnl": round(gross_pnl, 2),
                        "net_pnl": round(net_pnl, 2),
                        "commission": round(commission, 2),
                        "spread_cost": round(spread_cost, 2),
                        "slippage_cost": round(slippage_cost, 2),
                        "holding_bars": i - open_position["entry_bar_idx"]
                    })
                    open_position = None

            # If no open position, evaluate new signal on completed history
            if open_position is None:
                # Construct synthetic tick from current bar open
                tick = Tick(
                    timestamp=curr_bar.timestamp,
                    bid=curr_bar.open,
                    ask=curr_bar.open + spread_points,
                    last=curr_bar.open,
                    volume=curr_bar.volume,
                    spread=spread_points
                )

                decision = decision_engine.evaluate(
                    self.symbol_key,
                    self.spec,
                    history,
                    tick,
                    account,
                    active_positions_for_symbol=0
                )

                if decision.decision in ("BUY", "SELL") and decision.order_params:
                    order = decision.order_params
                    open_position = {
                        "action": order["action"],
                        "volume": order["volume"],
                        "entry_price": order["price"] + (slippage_points if order["action"] == "BUY" else -slippage_points),
                        "sl": order["sl"],
                        "tp": order["tp"],
                        "entry_time": curr_bar.timestamp,
                        "entry_bar_idx": i
                    }
                    account.open_positions_count = 1

        return BacktestReport(closed_trades, initial_capital)
