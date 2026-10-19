import React, { useState } from 'react';
import { WorkerStatusJson } from '../types';
import { Server, Terminal, FileCode, Check, Copy, RefreshCw, AlertCircle } from 'lucide-react';

interface DiagnosticsViewProps {
  status: WorkerStatusJson;
  onRefreshStatus?: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ status, onRefreshStatus }) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const wineCommands = `# 1. Verify Wine 64-bit environment and Python 3.10 inside Wine
export WINEPREFIX=~/.wine
wine python --version
# Expected: Python 3.10.x (tags/v3.10.x)

# 2. Verify MetaTrader 5 Python package in Wine
wine python -c "import MetaTrader5 as mt5; print('MT5 Package Version:', mt5.__version__)"

# 3. Test Terminal Discovery and Initialization
wine python -c "import MetaTrader5 as mt5; print('Init:', mt5.initialize(path='C:\\\\Program Files\\\\MetaTrader 5\\\\terminal64.exe'))"

# 4. Launch HC-NEXUS Quantitative Engine
python3 engine/main.py --mode PAPER --symbol XAUUSD`;

  const copyWineCommands = () => {
    navigator.clipboard.writeText(wineCommands);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Wine & IPC Architecture Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white uppercase tracking-wide">
              Wine & MetaTrader 5 Integration Diagnostics
            </h3>
          </div>
          <span className="text-xs bg-slate-800 text-cyan-400 font-mono px-2.5 py-1 rounded border border-cyan-500/30">
            IPC File Bridge: Active
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Ubuntu Environment</span>
            <span className="font-bold text-slate-100 text-sm">Ubuntu 24.04 LTS (x86_64)</span>
            <span className="text-[10px] text-slate-400 block">System Python: 3.10.12</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Wine Subsystem</span>
            <span className="font-bold text-emerald-400 text-sm">~/.wine (64-bit)</span>
            <span className="text-[10px] text-slate-400 block">Terminal: terminal64.exe</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">IPC Directory</span>
            <span className="font-bold text-purple-400 text-sm">MQL5/Files/hc_nexus</span>
            <span className="text-[10px] text-slate-400 block">Atomic write exchange</span>
          </div>
        </div>
      </div>

      {/* V16_WORKER_STATUS.json Live Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <FileCode className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              V16_WORKER_STATUS.json (Live Schema Inspector)
            </h3>
          </div>
          {onRefreshStatus && (
            <button
              onClick={onRefreshStatus}
              className="text-xs font-mono text-slate-400 hover:text-white flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          )}
        </div>

        <div className="mt-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800/90 text-xs font-mono overflow-x-auto text-emerald-300 max-h-72">
          <pre>{JSON.stringify(status, null, 2)}</pre>
        </div>
      </div>

      {/* Wine Terminal Diagnostic Commands */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl font-mono text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Exact Wine & Python 3.10 Verification Commands
            </h3>
          </div>
          <button
            onClick={copyWineCommands}
            className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Commands'}</span>
          </button>
        </div>

        <div className="mt-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto leading-relaxed">
          <pre>{wineCommands}</pre>
        </div>
      </div>
    </div>
  );
};
