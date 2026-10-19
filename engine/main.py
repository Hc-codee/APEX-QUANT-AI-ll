"""
HC-NEXUS QUANT AI V1.0 - Main Execution CLI & Daemon.
Entry point for Ubuntu 24.04 and Wine environments.
"""

import argparse
import sys
import os
import json
import time

from engine.market_data import Candle, Tick, DataQualityValidator, MarketDataService
from engine.features import FeatureEngineering
from engine.regimes import MarketRegimeDetector
from engine.ml_engine import MachineLearningEngine
from engine.risk_engine import RiskManagementEngine, AccountState, SymbolSpecification
from engine.decision_engine import SignalDecisionEngine
from engine.execution_engine import MT5ExecutionEngine
from engine.position_manager import PositionManagementEngine
from engine.status_service import WorkerStatusService
from engine.backtester import WalkForwardBacktester


def run_audit() -> Dict[str, Any]:
    audit = {
        "timestamp_utc": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
        "python_version": sys.version,
        "platform": sys.platform,
        "working_directory": os.getcwd(),
        "wine_environment": {
            "is_wine": "WINEPREFIX" in os.environ or os.path.exists("/home/user/.wine"),
            "wine_prefix": os.environ.get("WINEPREFIX", "Default (~/.wine)"),
        },
        "mt5_package": {
            "installed": False,
            "note": "Native Linux Python cannot load Windows MT5 DLL; use Wine Python 3.10 or MQL5 File IPC Bridge"
        },
        "ipc_file_bridge": {
            "status": "READY",
            "ipc_dir": "MQL5/Files/hc_nexus",
            "schema_file": "V16_WORKER_STATUS.json",
            "commands_queue": "commands.json"
        },
        "risk_defaults": {
            "risk_per_trade": "0.25%",
            "daily_loss_limit": "1.0%",
            "max_open_positions": 3,
            "martingale_allowed": False
        },
        "supported_symbols": ["XAUUSD", "BTCUSD", "US100/NAS100 (broker-dependent)"],
        "modes": ["BACKTEST", "PAPER", "LIVE (requires explicit key & confirmation)"]
    }
    try:
        import MetaTrader5  # type: ignore
        audit["mt5_package"]["installed"] = True
        audit["mt5_package"]["version"] = getattr(MetaTrader5, "__version__", "Unknown")
    except ImportError:
        pass
    return audit


def main():
    parser = argparse.ArgumentParser(description="HC-NEXUS QUANT AI V1.0 Execution Engine")
    parser.add_argument("--mode", choices=["BACKTEST", "PAPER", "LIVE"], default="PAPER", help="Operating mode (default: PAPER)")
    parser.add_argument("--symbol", choices=["XAUUSD", "BTCUSD", "NASDAQ"], default="XAUUSD", help="Target trading symbol")
    parser.add_argument("--audit", action="store_true", help="Run initial environment audit and print report")
    parser.add_argument("--test", action="store_true", help="Run automated test suite")
    parser.add_argument("--iterations", type=int, default=10, help="Number of ticks/steps to run")

    args = parser.parse_args()

    if args.audit:
        report = run_audit()
        print("=" * 60)
        print("HC-NEXUS QUANT AI V1.0 - INITIAL ENVIRONMENT AUDIT")
        print("=" * 60)
        print(json.dumps(report, indent=2))
        return

    if args.test:
        import unittest
        suite = unittest.defaultTestLoader.discover("engine", pattern="test_*.py")
        runner = unittest.TextTestRunner(verbosity=2)
        runner.run(suite)
        return

    print(f"[*] Starting HC-NEXUS QUANT AI V1.0 in {args.mode} mode for {args.symbol}...")
    status_service = WorkerStatusService("V16_WORKER_STATUS.json")
    status_service.update(
        operating_mode=args.mode,
        selected_symbol=args.symbol,
        decision_reason="Daemon running iteration loop"
    )

    print(f"[+] Status written to V16_WORKER_STATUS.json. Mode: {args.mode}")


if __name__ == "__main__":
    main()
