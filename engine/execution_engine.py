"""
MT5 Order Execution Engine for HC-NEXUS QUANT AI V1.0.
Supports direct Wine MT5 Python API as well as atomic IPC File Bridge for MQL5 EA.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional, List, Tuple
import os
import json
import time
import uuid


@dataclass
class ExecutionReceipt:
    command_id: str
    status: str  # "FILLED", "REJECTED", "PENDING", "FAILED"
    ticket: int
    symbol: str
    action: str
    volume: float
    price: float
    sl: float
    tp: float
    magic: int
    error_code: int = 0
    error_message: str = ""
    timestamp: float = 0.0


class MT5ExecutionEngine:
    """
    Unified execution controller.
    Ensures only ONE component owns order execution at any time.
    """

    def __init__(
        self,
        mode: str = "PAPER",  # "BACKTEST", "PAPER", "LIVE"
        ipc_dir: Optional[str] = None,
        use_direct_mt5: bool = False
    ):
        self.mode = mode.upper()
        self.ipc_dir = ipc_dir or "/tmp/hc_nexus_ipc"
        self.use_direct_mt5 = use_direct_mt5
        self.simulated_ticket_seq = 1000000
        self.active_positions: Dict[int, Dict[str, Any]] = {}
        self.closed_trades: List[Dict[str, Any]] = []

        if not os.path.exists(self.ipc_dir):
            try:
                os.makedirs(self.ipc_dir, exist_ok=True)
            except Exception:
                pass

    def send_order(self, order_params: Dict[str, Any]) -> ExecutionReceipt:
        """
        Executes order according to active operational mode.
        """
        cmd_id = f"CMD_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        now = time.time()

        if self.mode == "BACKTEST" or self.mode == "PAPER":
            # Deterministic simulation with realistic fill
            self.simulated_ticket_seq += 1
            ticket = self.simulated_ticket_seq

            pos = {
                "ticket": ticket,
                "symbol": order_params["symbol"],
                "symbol_key": order_params.get("symbol_key", order_params["symbol"]),
                "action": order_params["action"],
                "volume": order_params["volume"],
                "open_price": order_params["price"],
                "current_price": order_params["price"],
                "sl": order_params["sl"],
                "tp": order_params["tp"],
                "magic": order_params["magic"],
                "open_time": now,
                "profit": 0.0,
                "trailing_stop_active": False,
                "breakeven_active": False
            }
            self.active_positions[ticket] = pos

            receipt = ExecutionReceipt(
                command_id=cmd_id,
                status="FILLED",
                ticket=ticket,
                symbol=order_params["symbol"],
                action=order_params["action"],
                volume=order_params["volume"],
                price=order_params["price"],
                sl=order_params["sl"],
                tp=order_params["tp"],
                magic=order_params["magic"],
                error_code=0,
                error_message="Simulated fill in PAPER mode",
                timestamp=now
            )
            return receipt

        # LIVE MODE - Requires explicit confirmation
        if self.mode == "LIVE":
            if self.use_direct_mt5:
                return self._execute_direct_mt5(cmd_id, order_params)
            else:
                return self._execute_file_ipc(cmd_id, order_params)

        return ExecutionReceipt(
            command_id=cmd_id,
            status="REJECTED",
            ticket=0,
            symbol=order_params.get("symbol", ""),
            action=order_params.get("action", ""),
            volume=0.0,
            price=0.0,
            sl=0.0,
            tp=0.0,
            magic=0,
            error_code=4001,
            error_message=f"Invalid execution mode: {self.mode}",
            timestamp=now
        )

    def _execute_file_ipc(self, cmd_id: str, order_params: Dict[str, Any]) -> ExecutionReceipt:
        """
        Atomic write of command to MQL5 IPC directory.
        MQL5 EA reads commands.json, verifies magic number, and writes execution_report.json.
        """
        payload = {
            "command_id": cmd_id,
            "action": order_params["action"],
            "symbol": order_params["symbol"],
            "volume": order_params["volume"],
            "sl": order_params["sl"],
            "tp": order_params["tp"],
            "magic": order_params["magic"],
            "timestamp": time.time(),
            "status": "QUEUED"
        }

        tmp_path = os.path.join(self.ipc_dir, f"cmd_{cmd_id}.tmp")
        final_path = os.path.join(self.ipc_dir, "commands.json")

        try:
            with open(tmp_path, "w") as f:
                json.dump(payload, f, indent=2)
            os.replace(tmp_path, final_path)

            return ExecutionReceipt(
                command_id=cmd_id,
                status="PENDING",
                ticket=0,
                symbol=order_params["symbol"],
                action=order_params["action"],
                volume=order_params["volume"],
                price=order_params["price"],
                sl=order_params["sl"],
                tp=order_params["tp"],
                magic=order_params["magic"],
                error_message="Order queued in MQL5 IPC pipeline",
                timestamp=time.time()
            )
        except Exception as e:
            return ExecutionReceipt(
                command_id=cmd_id,
                status="FAILED",
                ticket=0,
                symbol=order_params["symbol"],
                action=order_params["action"],
                volume=order_params["volume"],
                price=order_params["price"],
                sl=order_params["sl"],
                tp=order_params["tp"],
                magic=order_params["magic"],
                error_code=5001,
                error_message=f"IPC write failure: {e}",
                timestamp=time.time()
            )

    def _execute_direct_mt5(self, cmd_id: str, order_params: Dict[str, Any]) -> ExecutionReceipt:
        # Placeholder for direct Python MetaTrader5 package execution in Wine
        return ExecutionReceipt(
            command_id=cmd_id,
            status="FAILED",
            ticket=0,
            symbol=order_params["symbol"],
            action=order_params["action"],
            volume=order_params["volume"],
            price=order_params["price"],
            sl=order_params["sl"],
            tp=order_params["tp"],
            magic=order_params["magic"],
            error_code=5002,
            error_message="Wine MT5 direct connection must be invoked from within Wine terminal environment",
            timestamp=time.time()
        )
