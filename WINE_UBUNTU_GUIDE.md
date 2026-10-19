# HC-NEXUS QUANT AI V1.0 — UBUNTU 24.04 & WINE SETUP GUIDE

This guide provides the exact commands to configure Ubuntu 24.04 LTS, Wine, MetaTrader 5, and the Python 3.10 Windows environment for HC-NEXUS QUANT AI V1.0.

---

## 1. Install Wine on Ubuntu 24.04 LTS

```bash
# Enable 32-bit architecture for Wine compatibility
sudo dpkg --add-architecture i386

# Add WineHQ official repository
sudo mkdir -pm755 /etc/apt/keyrings
sudo wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key
sudo wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources

# Update package index and install Wine Stable
sudo apt update
sudo apt install -y --install-recommends winehq-stable winetricks
```

---

## 2. Initialize Wine 64-bit Prefix

```bash
export WINEPREFIX=~/.wine
export WINEARCH=win64
wineboot --init
```

---

## 3. Install MetaTrader 5 under Wine

```bash
# Download official MetaTrader 5 setup
wget https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe

# Run MT5 installer in Wine
wine mt5setup.exe
```

*Follow the on-screen installer to install MT5 into:*  
`C:\Program Files\MetaTrader 5\terminal64.exe`

---

## 4. Install Windows Python 3.10 inside Wine

MetaTrader 5's official Python library requires a Windows Python installation to link with `mql.dll`:

```bash
# Download official Windows x64 Python 3.10 installer
wget https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe

# Run silent installer with PATH enabled
wine python-3.10.11-amd64.exe /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1
```

---

## 5. Install MetaTrader5 Python Package in Wine

```bash
# Verify Wine Python is responsive
wine python --version

# Upgrade pip and install MetaTrader5 package
wine python -m pip install --upgrade pip
wine python -m pip install MetaTrader5 numpy
```

---

## 6. Install MQL5 Bridge in MetaTrader 5

1. Open MetaTrader 5 via Wine:
   ```bash
   wine "C:\\Program Files\\MetaTrader 5\\terminal64.exe"
   ```
2. Open MetaEditor (F4) in MT5.
3. Copy `mql5/HC_Nexus_Bridge.mq5` into your MT5 `MQL5/Experts/` folder:
   ```bash
   cp mql5/HC_Nexus_Bridge.mq5 ~/.wine/drive_c/Program\ Files/MetaTrader\ 5/MQL5/Experts/
   ```
4. In MetaEditor, click **Compile** (F7).
5. Attach `HC_Nexus_Bridge` to an open chart (e.g. `XAUUSD, M15`).
6. Enable **Allow Algo Trading** in MT5 toolbar.

---

## 7. Run HC-NEXUS QUANT AI V1.0

### Run Environment Self-Audit
```bash
python3 engine/main.py --audit
```

### Run Automated Unit Tests
```bash
python3 engine/main.py --test
node --test src/utils/quant_engine.test.ts
```

### Run Paper Trading Mode
```bash
python3 engine/main.py --mode PAPER --symbol XAUUSD
```
