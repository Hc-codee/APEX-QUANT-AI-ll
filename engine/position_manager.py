"""
Position Management Engine for HC-NEXUS QUANT AI V1.0.
Handles dynamic ATR trailing stops, break-even adjustments,
and emergency trade closure.
"""

from typing import Dict, Any, List, Tuple
from dataclasses import dataclass


class PositionManagementEngine:
    def __init__(
        self,
        breakeven_atr_mult: float = 1.5,
        trailing_stop_atr_mult: float = 2.0
    ):
        self.breakeven_atr_mult = breakeven_atr_mult
        self.trailing_stop_atr_mult = trailing_stop_atr_mult

    def update_position(
        self,
        position: Dict[str, Any],
        current_price: float,
        current_atr: float
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Evaluates position against current price and ATR.
        Returns:
            - modified (bool): whether SL needs modification
            - action_description (str)
            - updated_fields (dict)
        """
        action = position["action"]
        open_price = position["open_price"]
        current_sl = position["sl"]
        modified = False
        updates = {}

        if action == "BUY":
            profit_points = current_price - open_price

            # 1. Check Break-Even
            if not position.get("breakeven_active", False):
                if profit_points >= (current_atr * self.breakeven_atr_mult):
                    new_sl = round(open_price + (current_atr * 0.1), 2)  # small buffer above entry
                    if new_sl > current_sl:
                        updates["sl"] = new_sl
                        updates["breakeven_active"] = True
                        modified = True
                        return True, f"Moved SL to Break-Even ({new_sl})", updates

            # 2. Check ATR Trailing Stop
            if profit_points > (current_atr * 2.0):
                trail_sl = round(current_price - (current_atr * self.trailing_stop_atr_mult), 2)
                if trail_sl > current_sl:
                    updates["sl"] = trail_sl
                    updates["trailing_stop_active"] = True
                    modified = True
                    return True, f"Trailing SL adjusted to {trail_sl}", updates

        elif action == "SELL":
            profit_points = open_price - current_price

            # 1. Check Break-Even
            if not position.get("breakeven_active", False):
                if profit_points >= (current_atr * self.breakeven_atr_mult):
                    new_sl = round(open_price - (current_atr * 0.1), 2)
                    if new_sl < current_sl:
                        updates["sl"] = new_sl
                        updates["breakeven_active"] = True
                        modified = True
                        return True, f"Moved SL to Break-Even ({new_sl})", updates

            # 2. Check ATR Trailing Stop
            if profit_points > (current_atr * 2.0):
                trail_sl = round(current_price + (current_atr * self.trailing_stop_atr_mult), 2)
                if trail_sl < current_sl:
                    updates["sl"] = trail_sl
                    updates["trailing_stop_active"] = True
                    modified = True
                    return True, f"Trailing SL adjusted to {trail_sl}", updates

        return False, "No stop adjustment required", {}
