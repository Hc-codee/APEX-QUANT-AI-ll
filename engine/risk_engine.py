"""
Risk Management Engine for HC-NEXUS QUANT AI V1.0.
Operates independently from prediction engine to enforce capital preservation,
exact broker volume step normalization, margin verification, and daily drawdown halts.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional, Tuple
import math


@dataclass
class AccountState:
    balance: float
    equity: float
    free_margin: float
    margin_used: float
    daily_start_equity: float
    current_daily_drawdown_pct: float
    open_positions_count: int
    emergency_halt: bool = False


@dataclass
class SymbolSpecification:
    symbol: str
    contract_size: float
    pip_size: float
    volume_min: float
    volume_max: float
    volume_step: float
    digits: int
    magic_number: int


class RiskManagementEngine:
    def __init__(
        self,
        risk_per_trade_fraction: float = 0.0025,  # 0.25%
        max_daily_loss_fraction: float = 0.01,     # 1.0%
        max_open_positions: int = 3,
        max_open_positions_per_symbol: int = 1,
        min_atr_stop_multiplier: float = 1.5
    ):
        self.risk_per_trade_fraction = risk_per_trade_fraction
        self.max_daily_loss_fraction = max_daily_loss_fraction
        self.max_open_positions = max_open_positions
        self.max_open_positions_per_symbol = max_open_positions_per_symbol
        self.min_atr_stop_multiplier = min_atr_stop_multiplier

    def validate_account_for_trading(self, account: AccountState) -> Tuple[bool, str]:
        if account.emergency_halt:
            return False, "Emergency Halt is currently ACTIVE"

        if account.equity <= 0:
            return False, "Non-positive account equity"

        daily_loss = (account.daily_start_equity - account.equity) / account.daily_start_equity
        if daily_loss >= self.max_daily_loss_fraction:
            return False, f"Daily loss limit breached: {daily_loss * 100:.2f}% >= {self.max_daily_loss_fraction * 100:.1f}% limit"

        if account.open_positions_count >= self.max_open_positions:
            return False, f"Maximum open portfolio positions ({self.max_open_positions}) reached"

        if account.free_margin < (account.equity * 0.20):
            return False, "Insufficient free margin (free margin < 20% of equity)"

        return True, "Account parameters within safe operational thresholds"

    def calculate_position_size(
        self,
        account: AccountState,
        spec: SymbolSpecification,
        entry_price: float,
        stop_loss_price: float,
        estimated_spread_cost: float = 0.0
    ) -> Tuple[bool, float, str, Dict[str, float]]:
        """
        Calculates exact volume adhering to fractional risk and broker step rules:
        - Risk Amount = Equity * 0.0025
        - Pip Distance = abs(entry - stop_loss)
        - Value per 1 lot per point = contract_size * pip_size
        """
        acc_valid, acc_reason = self.validate_account_for_trading(account)
        if not acc_valid:
            return False, 0.0, acc_reason, {}

        price_diff = abs(entry_price - stop_loss_price)
        if price_diff <= 0:
            return False, 0.0, "Zero or inverted stop loss distance", {}

        # Minimum stop distance check
        min_dist = spec.pip_size * 5.0
        if price_diff < min_dist:
            return False, 0.0, f"Stop loss distance ({price_diff:.4f}) is below minimum safe threshold ({min_dist:.4f})", {}

        monetary_risk_budget = account.equity * self.risk_per_trade_fraction

        # Value per unit price change for 1.0 standard lot
        value_per_price_unit_1lot = spec.contract_size

        loss_per_lot = (price_diff * value_per_price_unit_1lot) + estimated_spread_cost
        if loss_per_lot <= 0:
            return False, 0.0, "Calculated loss per lot is non-positive", {}

        raw_volume = monetary_risk_budget / loss_per_lot

        # Round down to exact volume step to avoid over-risking
        step = spec.volume_step
        if step <= 0:
            step = 0.01

        steps_count = math.floor(raw_volume / step)
        normalized_volume = round(steps_count * step, spec.digits if spec.digits <= 2 else 2)

        # Min / max clamping
        if normalized_volume < spec.volume_min:
            return (
                False,
                0.0,
                f"Calculated size ({raw_volume:.3f} lots) is below broker minimum ({spec.volume_min:.2f} lots)",
                {"raw_volume": raw_volume, "budget": monetary_risk_budget}
            )

        if normalized_volume > spec.volume_max:
            normalized_volume = spec.volume_max

        # Margin sanity check (assuming conservative 1:50 or 1:100 leverage proxy)
        estimated_margin_required = (normalized_volume * spec.contract_size * entry_price) / 50.0
        if estimated_margin_required > account.free_margin * 0.5:
            return (
                False,
                0.0,
                f"Order would consume excessive free margin ({estimated_margin_required:.2f} > 50% of {account.free_margin:.2f})",
                {}
            )

        actual_monetary_risk = normalized_volume * loss_per_lot

        metadata = {
            "monetary_risk_budget": round(monetary_risk_budget, 2),
            "actual_monetary_risk": round(actual_monetary_risk, 2),
            "raw_volume": round(raw_volume, 4),
            "normalized_volume": normalized_volume,
            "loss_per_lot": round(loss_per_lot, 2),
            "price_diff": round(price_diff, 4),
            "estimated_margin": round(estimated_margin_required, 2),
        }

        return True, normalized_volume, "Position size validated cleanly", metadata
