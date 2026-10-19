//+------------------------------------------------------------------+
//|                                           HC_Nexus_Bridge.mq5   |
//|                        HC-NEXUS QUANT AI V1.0 Execution Bridge   |
//|                    Copyright 2026, Quantitative Systems Architect|
//+------------------------------------------------------------------+
#property copyright "HC-NEXUS QUANT AI"
#property link      "https://nexus-quant-ai.local"
#property version   "1.00"
#property description "Zero-Dependency IPC Bridge for Wine/Linux MetaTrader 5"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>
#include <Trade\PositionInfo.mqh>

//--- Input Parameters
input group "=== HC-NEXUS IPC CONFIGURATION ==="
input string   InpIpcFolder       = "hc_nexus";           // IPC Subfolder in MQL5/Files
input ulong    InpMagicBase       = 881000;               // Base Magic Number
input int      InpPollIntervalMs  = 250;                  // IPC Polling Interval (ms)
input double   InpMaxSlippagePips = 3.0;                  // Max Allowed Slippage
input bool     InpEnforceSession  = true;                 // Enforce Trading Hours

//--- Global Objects
CTrade         g_trade;
CSymbolInfo    g_symInfo;
CPositionInfo  g_posInfo;
int            g_timerId = 0;
string         g_lastProcessedCmdId = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   PrintFormat("[HC-NEXUS BRIDGE] Initializing EA on %s. IPC Folder: MQL5\\Files\\%s", _Symbol, InpIpcFolder);
   
   g_trade.SetExpertMagicNumber(InpMagicBase);
   g_trade.SetMarginMode();
   g_trade.SetTypeFillingBySymbol(_Symbol);
   g_trade.SetDeviationInPoints((ulong)(InpMaxSlippagePips * 10));

   // Create IPC directory if not exists
   ResetLastError();
   FolderCreate(InpIpcFolder);

   // Start High-Frequency Timer
   EventSetMillisecondTimer(InpPollIntervalMs);
   
   BroadcastStatus();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[HC-NEXUS BRIDGE] Deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Timer event handler for polling commands                         |
//+------------------------------------------------------------------+
void OnTimer()
{
   PollCommands();
   static uint lastBroadcast = 0;
   if(GetTickCount() - lastBroadcast > 1000)
   {
      BroadcastStatus();
      lastBroadcast = GetTickCount();
   }
}

//+------------------------------------------------------------------+
//| Tick event handler                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   // Push tick telemetry to IPC buffer
   static ulong tickCounter = 0;
   tickCounter++;
   if(tickCounter % 5 == 0)
   {
      BroadcastTicks();
   }
}

//+------------------------------------------------------------------+
//| Poll commands.json from Python engine                            |
//+------------------------------------------------------------------+
void PollCommands()
{
   string filename = InpIpcFolder + "\\commands.json";
   if(!FileIsExist(filename)) return;

   int fileHandle = FileOpen(filename, FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ);
   if(fileHandle == INVALID_HANDLE) return;

   string content = "";
   while(!FileIsEnding(fileHandle))
   {
      content += FileReadString(fileHandle);
   }
   FileClose(fileHandle);

   if(StringLen(content) < 10) return;

   // Simple structured parser for command JSON
   string cmdId  = ExtractJsonString(content, "command_id");
   string action = ExtractJsonString(content, "action");
   string symbol = ExtractJsonString(content, "symbol");
   double volume = ExtractJsonDouble(content, "volume");
   double sl     = ExtractJsonDouble(content, "sl");
   double tp     = ExtractJsonDouble(content, "tp");
   ulong  magic  = (ulong)ExtractJsonDouble(content, "magic");

   // Prevent duplicate execution
   if(cmdId == "" || cmdId == g_lastProcessedCmdId) return;

   PrintFormat("[HC-NEXUS BRIDGE] Executing Command %s: %s %.2f %s (SL: %.2f, TP: %.2f)", 
               cmdId, action, volume, symbol, sl, tp);

   ExecuteOrder(cmdId, action, symbol, volume, sl, tp, magic);
   g_lastProcessedCmdId = cmdId;

   // Remove processed command file
   FileDelete(filename);
}

//+------------------------------------------------------------------+
//| Execute incoming trade order with robust checking                |
//+------------------------------------------------------------------+
void ExecuteOrder(string cmdId, string action, string symbol, double volume, double sl, double tp, ulong magic)
{
   if(!g_symInfo.Name(symbol))
   {
      WriteExecutionReport(cmdId, "REJECTED", 0, "Invalid symbol: " + symbol);
      return;
   }
   g_symInfo.RefreshRates();

   g_trade.SetExpertMagicNumber(magic > 0 ? magic : InpMagicBase);

   bool success = false;
   if(action == "BUY")
   {
      double ask = g_symInfo.Ask();
      success = g_trade.Buy(volume, symbol, ask, sl, tp, "HC-NEXUS " + cmdId);
   }
   else if(action == "SELL")
   {
      double bid = g_symInfo.Bid();
      success = g_trade.Sell(volume, symbol, bid, sl, tp, "HC-NEXUS " + cmdId);
   }
   else if(action == "CLOSE_ALL")
   {
      CloseAllPositionsForMagic(magic);
      WriteExecutionReport(cmdId, "FILLED", 0, "Emergency Close Completed");
      return;
   }

   if(success)
   {
      ulong dealTicket = g_trade.ResultDeal();
      ulong orderTicket = g_trade.ResultOrder();
      PrintFormat("[HC-NEXUS BRIDGE] Order SUCCESS. Order Ticket: %I64u, Deal: %I64u", orderTicket, dealTicket);
      WriteExecutionReport(cmdId, "FILLED", orderTicket, "Trade executed successfully");
   }
   else
   {
      uint retCode = g_trade.ResultRetcode();
      string desc  = g_trade.ResultRetcodeDescription();
      PrintFormat("[HC-NEXUS BRIDGE] Order FAILED. Code: %u (%s)", retCode, desc);
      WriteExecutionReport(cmdId, "REJECTED", 0, desc);
   }
}

//+------------------------------------------------------------------+
//| Emergency Close of all positions owned by HC-NEXUS               |
//+------------------------------------------------------------------+
void CloseAllPositionsForMagic(ulong magic)
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(g_posInfo.SelectByIndex(i))
      {
         if(g_posInfo.Magic() == magic || magic == 0)
         {
            g_trade.PositionClose(g_posInfo.Ticket());
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Write execution report for Python engine                         |
//+------------------------------------------------------------------+
void WriteExecutionReport(string cmdId, string status, ulong ticket, string msg)
{
   string filename = InpIpcFolder + "\\execution_report.json";
   int handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(handle != INVALID_HANDLE)
   {
      string json = StringFormat("{\n  \"command_id\": \"%s\",\n  \"status\": \"%s\",\n  \"ticket\": %I64u,\n  \"message\": \"%s\",\n  \"time\": %u\n}",
                                 cmdId, status, ticket, msg, (uint)TimeCurrent());
      FileWriteString(handle, json);
      FileClose(handle);
   }
}

//+------------------------------------------------------------------+
//| Broadcast account & open positions to V16_WORKER_STATUS.json     |
//+------------------------------------------------------------------+
void BroadcastStatus()
{
   string filename = InpIpcFolder + "\\V16_WORKER_STATUS.json";
   int handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE) return;

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   int openCount  = PositionsTotal();

   string json = "{\n";
   json += "  \"system_name\": \"HC-NEXUS QUANT AI V1.0\",\n";
   json += "  \"connection_status\": \"CONNECTED\",\n";
   json += StringFormat("  \"account_balance\": %.2f,\n", balance);
   json += StringFormat("  \"account_equity\": %.2f,\n", equity);
   json += StringFormat("  \"free_margin\": %.2f,\n", margin);
   json += StringFormat("  \"open_positions_count\": %d,\n", openCount);
   json += StringFormat("  \"server_time\": \"%s\"\n", TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS));
   json += "}";

   FileWriteString(handle, json);
   FileClose(handle);
}

//+------------------------------------------------------------------+
//| Broadcast real-time bid/ask tick to IPC                          |
//+------------------------------------------------------------------+
void BroadcastTicks()
{
   MqlTick lastTick;
   if(SymbolInfoTick(_Symbol, lastTick))
   {
      string filename = InpIpcFolder + "\\market_ticks.json";
      int handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
      if(handle != INVALID_HANDLE)
      {
         string json = StringFormat("{\"symbol\": \"%s\", \"bid\": %.5f, \"ask\": %.5f, \"spread\": %.5f, \"time\": %I64d}",
                                    _Symbol, lastTick.bid, lastTick.ask, lastTick.ask - lastTick.bid, (long)lastTick.time);
         FileWriteString(handle, json);
         FileClose(handle);
      }
   }
}

//--- Helper JSON string parser
string ExtractJsonString(string json, string key)
{
   string target = "\"" + key + "\":";
   int pos = StringFind(json, target);
   if(pos < 0) return "";
   pos += StringLen(target);
   while(pos < StringLen(json) && (StringGetCharacter(json, pos) == ' ' || StringGetCharacter(json, pos) == '\"'))
      pos++;
   int endPos = pos;
   while(endPos < StringLen(json) && StringGetCharacter(json, endPos) != '\"' && StringGetCharacter(json, endPos) != ',' && StringGetCharacter(json, endPos) != '\n' && StringGetCharacter(json, endPos) != '}')
      endPos++;
   return StringSubstr(json, pos, endPos - pos);
}

//--- Helper JSON number parser
double ExtractJsonDouble(string json, string key)
{
   string val = ExtractJsonString(json, key);
   return StringToDouble(val);
}
