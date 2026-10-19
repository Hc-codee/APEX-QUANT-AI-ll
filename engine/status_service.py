"""
Status & Telemetry Service for HC-NEXUS QUANT AI V1.0.
Maintains and atomically writes V16_WORKER_STATUS.json for MT5 EA, Dashboard, and Monitor.
"""

from typing import Dict, Any, Optional
import os
import json
import time


class WorkerStatusService:
    def __init__(self, output_path: str = "V16_WORKER_STATUS.json"):
        self.output_path = output_path
        self.state: Dict[str, Any] = {
            "system_name": "HC-NEXUS QUANT AI V1.0",
            "operating_mode": "PAPER",
            "connection_status": "ONLINE",
            "last_update_utc": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
            "last_heartbeat_timestamp": time.time(),
            "selected_symbol": "XAUUSD",
            "broker_symbol_actual": "XAUUSD",
            "market_regime": "TRENDING_BULL",
            "trading_decision": "HOLD",
            "calibrated_probability": 0.52,
            "entry_price": 2724.50,
            "stop_loss": 2712.00,
            "take_profit": 2743.25,
            "position_size": 0.12,
            "estimated_monetary_risk": 25.00,
            "open_positions_count": 0,
            "open_positions": [],
            "account_equity": 10000.00,
            "account_balance": 10000.00,
            "free_margin": 10000.00,
            "unrealized_pnl": 0.00,
            "realized_pnl_today": 0.00,
            "daily_drawdown_pct": 0.00,
            "daily_loss_limit_pct": 1.00,
            "emergency_halt": False,
            "last_error": None,
            "decision_reason": "System initialized in PAPER monitoring mode"
        }
        self.write_status()

    def update(self, **kwargs) -> Dict[str, Any]:
        self.state.update(kwargs)
        self.state["last_update_utc"] = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
        self.state["last_heartbeat_timestamp"] = time.time()
        self.write_status()
        return self.state

    def write_status(self) -> bool:
        tmp_path = f"{self.output_path}.tmp"
        try:
            with open(tmp_path, "w") as f:
                json.dump(self.state, f, indent=2)
            os.replace(tmp_path, self.output_path)
            return True
        except Exception as e:
            print(f"[WorkerStatusService] Write error: {e}")
            return False
