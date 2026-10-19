import React, { useState } from 'react';
import { CandleData, MarketTick } from '../types';

interface PriceChartProps {
  candles: CandleData[];
  tick: MarketTick;
  slPrice?: number;
  tpPrice?: number;
  entryPrice?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  candles,
  tick,
  slPrice,
  tpPrice,
  entryPrice,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!candles || candles.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-500 font-mono">Loading market candles...</div>;
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const minLow = Math.min(...lows);
  const maxHigh = Math.max(...highs);
  const priceRange = maxHigh - minLow || 1.0;

  const chartHeight = 240;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const getY = (price: number) => {
    return paddingY + usableHeight - ((price - minLow) / priceRange) * usableHeight;
  };

  const candleSpacing = usableWidth / candles.length;
  const candleBodyWidth = Math.max(candleSpacing * 0.65, 3);

  // Compute 20-period SMA line points
  const smaPoints: string[] = [];
  for (let i = 19; i < candles.length; i++) {
    const slice = candles.slice(i - 19, i + 1);
    const avg = slice.reduce((acc, c) => acc + c.close, 0) / 20;
    const x = paddingX + i * candleSpacing + candleSpacing / 2;
    const y = getY(avg);
    smaPoints.push(`${x},${y}`);
  }

  const hoveredCandle = hoverIndex !== null ? candles[hoverIndex] : candles[candles.length - 1];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Chart Header with Live Price Quotes */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-white text-base font-mono">{tick.symbol}</span>
          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            M15 Interval
          </span>
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="text-slate-400">Spread:</span>
            <span className="text-amber-400 font-semibold">{tick.spreadPips.toFixed(1)} pips</span>
          </div>
        </div>

        {/* Live Bid/Ask Box */}
        <div className="flex items-center space-x-3 font-mono text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block uppercase">Bid</span>
            <span className="text-rose-400 font-bold text-sm">${tick.bid.toFixed(tick.digits)}</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400 text-[10px] block uppercase">Ask</span>
            <span className="text-emerald-400 font-bold text-sm">${tick.ask.toFixed(tick.digits)}</span>
          </div>
        </div>
      </div>

      {/* Bar Inspection Tooltip Strip */}
      <div className="py-2 text-[11px] font-mono text-slate-300 flex flex-wrap gap-4 border-b border-slate-800/60">
        <span>Bar Time: <b className="text-white">{hoveredCandle.time}</b></span>
        <span>O: <b className="text-slate-100">${hoveredCandle.open.toFixed(tick.digits)}</b></span>
        <span>H: <b className="text-emerald-400">${hoveredCandle.high.toFixed(tick.digits)}</b></span>
        <span>L: <b className="text-rose-400">${hoveredCandle.low.toFixed(tick.digits)}</b></span>
        <span>C: <b className={hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'}>${hoveredCandle.close.toFixed(tick.digits)}</b></span>
        <span>Vol: <b className="text-slate-400">{hoveredCandle.volume}</b></span>
      </div>

      {/* SVG Canvas Candlestick Chart */}
      <div className="relative mt-3 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto select-none"
          style={{ minHeight: '220px' }}
        >
          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
            const p = minLow + ratio * priceRange;
            const y = getY(p);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={chartWidth - paddingX + 5}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  ${p.toFixed(tick.digits <= 2 ? 1 : 2)}
                </text>
              </g>
            );
          })}

          {/* SMA 20 Overlay Line */}
          {smaPoints.length > 1 && (
            <polyline
              points={smaPoints.join(' ')}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeOpacity="0.75"
            />
          )}

          {/* Candlesticks */}
          {candles.map((c, i) => {
            const x = paddingX + i * candleSpacing + candleSpacing / 2;
            const isBull = c.close >= c.open;
            const candleColor = isBull ? '#10b981' : '#f43f5e';
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);

            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(Math.abs(yClose - yOpen), 2);

            return (
              <g
                key={c.timestamp}
                onMouseEnter={() => setHoverIndex(i)}
                className="cursor-pointer"
              >
                {/* Wick */}
                <line
                  x1={x}
                  y1={yHigh}
                  x2={x}
                  y2={yLow}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={x - candleBodyWidth / 2}
                  y={bodyTop}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={isBull ? '#059669' : '#e11d48'}
                  rx="1"
                />
              </g>
            );
          })}

          {/* SL / TP / Entry Target Lines if provided */}
          {entryPrice && (
            <line
              x1={paddingX}
              y1={getY(entryPrice)}
              x2={chartWidth - paddingX}
              y2={getY(entryPrice)}
              stroke="#38bdf8"
              strokeDasharray="5 3"
              strokeWidth="1.2"
            />
          )}

          {slPrice && (
            <g>
              <line
                x1={paddingX}
                y1={getY(slPrice)}
                x2={chartWidth - paddingX}
                y2={getY(slPrice)}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text
                x={paddingX + 6}
                y={getY(slPrice) - 4}
                fill="#f43f5e"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                SL: ${slPrice.toFixed(tick.digits)}
              </text>
            </g>
          )}

          {tpPrice && (
            <g>
              <line
                x1={paddingX}
                y1={getY(tpPrice)}
                x2={chartWidth - paddingX}
                y2={getY(tpPrice)}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text
                x={paddingX + 6}
                y={getY(tpPrice) - 4}
                fill="#10b981"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                TP: ${tpPrice.toFixed(tick.digits)}
              </text>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 px-2">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
              <span>SMA 20 Trend</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-sm inline-block" />
              <span>Bull Bar</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-rose-500 rounded-sm inline-block" />
              <span>Bear Bar</span>
            </span>
          </div>
          <div>Tick Refresh: 1000ms</div>
        </div>
      </div>
    </div>
  );
};
