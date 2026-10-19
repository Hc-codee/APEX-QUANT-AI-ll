# HC-NEXUS QUANT AI V1.0 — INITIAL ENVIRONMENT & SYSTEM AUDIT REPORT

**Date:** October 2026  
**Auditor:** Senior Quantitative Systems Architect & Trading Infrastructure Engineer  
**Scope:** Operating environment, Wine integration, Python version, MT5 IPC mechanisms, and algorithmic safeguards.

---

## 1. Operating Environment Audit

| Parameter | Inspected / Required Value | Status | Finding & Architecture Recommendation |
| :--- | :--- | :--- | :--- |
| **Operating System** | Ubuntu 24.04 LTS (x86_64) | VERIFIED | Running standard Linux kernel. Direct MT5 Windows GUI requires Wine emulation or remote execution. |
| **System Python** | Python 3.10.12 (`/usr/bin/python3`) | VERIFIED | Native Linux Python is available. Note: the proprietary MetaTrader5 Python package relies on Windows Win32 API DLLs (`mql.dll`) and cannot be imported in native Linux ELF format. |
| **Wine Environment** | Target: Wine 9.x/10.x with 64-bit WINEPREFIX (`~/.wine`) | ARCHITECTED | Wine 64-bit environment is required to host MT5 `terminal64.exe` and Windows Python 3.10 x64. |
| **Wine Python Interpreter** | `~/.wine/drive_c/users/<user>/AppData/Local/Programs/Python/Python310/python.exe` | CONFIGURED | Allows native execution of `pip install MetaTrader5` directly inside the Windows subsystem. |
| **MT5 Terminal Executable** | `C:\Program Files\MetaTrader 5\terminal64.exe` | CONFIGURED | Standard MetaTrader 5 terminal location under Wine `drive_c`. |
| **Dual Execution Path** | Direct Wine Python API + MQL5 File IPC Bridge (`HC_Nexus_Bridge.mq5`) | IMPLEMENTED | Resilient zero-dependency fallback via atomic file transactions in `MQL5/Files/hc_nexus/`. |

---

## 2. Component Status Analysis

### A. Working & Verified Components
- **DataQualityValidator (`engine/market_data.py`, `src/utils/quant_engine.ts`)**:
  - Chronological sequence enforcement and duplicate timestamp detection.
  - Strict isolation of completed closed bars from current unclosed live bar (zero look-ahead bias).
  - Stale tick rejection (> 5.0 seconds threshold) and inverted/spread-blowout protection.
- **FeatureEngineering (`engine/features.py`)**:
  - Point-in-time calculation of multi-horizon returns (1, 3, 5, 12 periods).
  - Normalized ATR (NATR), Wilder's smoothed ATR, ADX (14-period), RSI (14-period).
  - Moving average relationships (SMA-20, EMA-50 distance, Donchian 20-period breakout position).
  - Microstructure features: candle body ratio, upper/lower wick ratios.
  - UTC cyclic hour features (`hour_sin`, `hour_cos`) for session alignment.
- **MarketRegimeDetector (`engine/regimes.py`)**:
  - Six distinct regimes: `TRENDING_BULL`, `TRENDING_BEAR`, `RANGING_LOW_VOL`, `RANGING_HIGH_VOL`, `VOLATILITY_EXPANSION`, `ABNORMAL_UNRELIABLE`.
  - Non-tradeable gating for abnormal spread widening or extreme realized volatility (> 4%).
- **MachineLearningEngine (`engine/ml_engine.py`)**:
  - Point-in-time feature vector scoring with calibrated logistic baseline.
  - Sigmoid Platt scaling calibration with Brier score and Log Loss metrics.
  - NO TRADE boundary enforcement: neutral band (45%–55%) and cost-hurdle rejection.
- **RiskManagementEngine (`engine/risk_engine.py`)**:
  - Strict 0.25% equity risk per trade.
  - Hard 1.0% daily loss circuit breaker: immediately halts new orders if daily equity drops >= 1.0%.
  - Broker volume-step normalization (e.g. 0.01 lot or 0.1 lot step rounding down to avoid over-risking).
  - Margin verification: requires free margin >= 2x estimated required margin.
  - Absolute prohibition of martingale and grid averaging down.
- **Asset-Specific Strategies (`engine/strategies.py`)**:
  - **XAUUSD (Gold)**: London/NY overlap session filters (07:00–21:00 UTC), Friday pre-close exit, spread cap <= 3.5 pips.
  - **BTCUSD (Bitcoin)**: 24/7 continuous trading, Sunday rollover filter, spread cap <= $35.0.
  - **NASDAQ Index CFD**: Symbol alias detection (`US100`, `NAS100`, `USTEC`), US cash open whipsaw filter (13:30–13:40 UTC lockout), spread cap <= 2.5 pts.
- **12-Step Signal Decision Pipeline (`engine/decision_engine.py`)**:
  - Step 1: Validate data -> Step 2: Session/Spread -> Step 3: Market Regime -> Step 4: Features -> Step 5: Raw ML -> Step 6: Probability Calibration -> Step 7: Cost Hurdle -> Step 8: Strategy SL/TP -> Step 9: Portfolio Limits -> Step 10: Risk Sizing -> Step 11: Pre-Execution Order Checks -> Step 12: Authorization.
- **MT5 MQL5 Bridge (`mql5/HC_Nexus_Bridge.mq5`)**:
  - High-frequency timer polling `commands.json`, atomic execution, and ticket reporting in `execution_report.json`.
  - Continuous telemetry broadcast into `V16_WORKER_STATUS.json`.
- **Status & Reporting (`V16_WORKER_STATUS.json`)**:
  - Preserved exact filename and schema with atomic writes.

---

## 3. Integration Risks & Mitigations

1. **Wine Process Latency & IPC Lock**:
   - *Risk:* Multiple processes attempting simultaneous file write to `commands.json` could cause corruption or read locks.
   - *Mitigation:* Temporary file write (`.tmp`) followed by atomic rename (`os.replace` / atomic file exchange), timestamped unique command IDs, and automatic command deletion once consumed by MQL5.
2. **Broker Symbol Name Discrepancies**:
   - *Risk:* Different brokers use `XAUUSD`, `GOLD`, `XAUUSDm`, or `US100`, `NAS100`, `USTEC`.
   - *Mitigation:* Symbol specification catalog with dynamic alias resolution and broker specification discovery.
3. **Execution Uncertainty & Duplicate Orders**:
   - *Risk:* Network timeout during MT5 order send could lead to duplicate orders on retry.
   - *Mitigation:* Idempotent command IDs, magic number tagging per asset (881001, 881002, 881003), and checking existing open positions prior to retrying.
4. **Sudden Daily Drawdown Spike**:
   - *Risk:* Consecutive adverse market moves exceeding safe limits.
   - *Mitigation:* Independent `RiskManagementEngine` running independently of prediction models, cutting off new entries when daily drawdown reaches 1.0% of day-start equity.

---

## 4. Operational Modes

- **BACKTEST**: Chronological historical replay with spread, commission ($5/lot), and slippage modeling.
- **PAPER (Default)**: Live market simulation connecting to real-time MT5 tick stream without placing real capital at risk.
- **LIVE**: Capital-committed execution requiring manual operator unlock and verified broker credentials.
