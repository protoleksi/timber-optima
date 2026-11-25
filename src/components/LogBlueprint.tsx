import React, { useState, useRef } from 'react';
import { Board, LogInput, SawingResult } from '../engine/types';
import { getCrossSectionRadii } from '../engine/geometry';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LogBlueprintProps {
  title: string;
  result: SawingResult;
  log: LogInput;
  badge?: string;
  badgeColor?: string;
}

export const LogBlueprint: React.FC<LogBlueprintProps> = ({
  title,
  result,
  log,
  badge,
  badgeColor,
}) => {
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoveredBoard, setHoveredBoard] = useState<Board | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  const { rx: rx0, ry: ry0 } = getCrossSectionRadii(0, log.topDiameter, log.ovality, log.taper);
  const { rx: rxL, ry: ryL } = getCrossSectionRadii(log.length, log.topDiameter, log.ovality, log.taper);

  const maxRadius = Math.max(rxL, ryL, 180);
  const margin = 45;
  const viewBoxSize = (maxRadius + margin) * 2;
  const halfSize = viewBoxSize / 2;

  // Вычисляем крайнюю верхнюю точку всех досок с учётом поворота (для безопасного выноса 2ry)
  const rotRad = (result.rotationAngle * Math.PI) / 180;
  const cosA = Math.cos(rotRad);
  const sinA = Math.sin(rotRad);

  let minYRotated = -ry0;
  for (const b of result.boards) {
    const hw = b.sawWidth / 2;
    const hh = b.sawHeight / 2;
    const corners = [
      { x: b.x - hw, y: b.y - hh },
      { x: b.x - hw, y: b.y + hh },
      { x: b.x + hw, y: b.y - hh },
      { x: b.x + hw, y: b.y + hh },
    ];
    for (const c of corners) {
      const yr = c.x * sinA + c.y * cosA;
      if (yr < minYRotated) minYRotated = yr;
    }
  }
  const label2ryY = Math.min(-ry0 - 8, minYRotated - 8);

  // Grid step: 50 mm primary
  const gridTicks: number[] = [];
  const maxTick = Math.ceil(maxRadius / 50) * 50;
  for (let t = -maxTick; t <= maxTick; t += 50) {
    if (t !== 0) gridTicks.push(t);
  }

  // Zone colors adapted for light and dark themes
  const getZoneStyle = (zone: Board['zone']) => {
    if (isDark) {
      switch (zone) {
        case 'core':
          return {
            fill: '#854D0E',      // muted warm amber
            stroke: '#EAB308',    // amber border
            textColor: '#FEF9C3', // high-contrast light yellow
            label: 'Центральная (брус)',
          };
        case 'side':
          return {
            fill: '#1E3A8A',      // muted blue
            stroke: '#3B82F6',    // blue border
            textColor: '#EFF6FF', // high-contrast white-blue
            label: 'Боковая (1-й / 2-й проход)',
          };
        case 'taperSide':
          return {
            fill: '#14532D',      // muted green
            stroke: '#22C55E',    // green border
            textColor: '#F0FDF4', // high-contrast light green
            label: 'Короткая (сбег)',
          };
        default:
          return {
            fill: '#27272A',
            stroke: '#71717A',
            textColor: '#F4F4F5',
            label: 'Доска',
          };
      }
    } else {
      switch (zone) {
        case 'core':
          return {
            fill: '#FDE68A',      // warm amber
            stroke: '#B45309',    // dark amber border
            textColor: '#451A03', // dark brown text
            label: 'Центральная (брус)',
          };
        case 'side':
          return {
            fill: '#DBEAFE',      // calm light blue
            stroke: '#1D4ED8',    // blue border
            textColor: '#1E3A8A', // dark navy text
            label: 'Боковая (1-й / 2-й проход)',
          };
        case 'taperSide':
          return {
            fill: '#D1FAE5',      // soft green
            stroke: '#047857',    // green border
            textColor: '#064E3B', // dark green text
            label: 'Короткая (сбег)',
          };
        default:
          return {
            fill: '#F1F5F9',
            stroke: '#64748B',
            textColor: '#0F172A',
            label: 'Доска',
          };
      }
    }
  };

  const updateTooltipPos = (e: React.MouseEvent, board: Board) => {
    const rect =
      canvasRef.current?.getBoundingClientRect() ??
      e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHoveredBoard(board);
  };

  const defaultBadgeColor = isDark
    ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
    : 'bg-slate-100 text-slate-700 border-slate-300';

  return (
    <div
      className={`relative flex flex-col border rounded-lg overflow-hidden shadow-none transition-colors ${
        isDark ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200'
      }`}
    >
      {/* Blueprint Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b transition-colors ${
          isDark ? 'bg-[#18181B] border-[#27272A]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`font-semibold text-xs sm:text-sm ${
              isDark ? 'text-[#F4F4F5]' : 'text-slate-800'
            }`}
          >
            {title}
          </span>
          {badge && (
            <span
              className={`text-xs px-2 py-0.5 rounded font-mono font-medium border ${
                badgeColor || defaultBadgeColor
              }`}
            >
              {badge}
            </span>
          )}
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono hidden sm:inline ${
              isDark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            Угол: {result.rotationAngle}° | Брус: {result.cantThickness} мм
          </span>
          <div
            className={`h-3 w-px mx-1 hidden sm:block ${
              isDark ? 'bg-zinc-700' : 'bg-slate-300'
            }`}
          />
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.15, 1.8))}
            className={`p-1 rounded transition ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Приблизить"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.7))}
            className={`p-1 rounded transition ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Отдалить"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className={`p-1 rounded transition ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
            title="Сбросить масштаб"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        ref={canvasRef}
        className={`relative w-full aspect-square max-h-[390px] sm:max-h-[480px] flex items-center justify-center p-1 sm:p-2 select-none overflow-hidden cursor-crosshair transition-colors ${
          isDark ? 'bg-[#111113]' : 'bg-white'
        }`}
        onClick={() => setHoveredBoard(null)}
        onMouseLeave={() => setHoveredBoard(null)}
      >
        <svg
          viewBox={`${-halfSize * zoom} ${-halfSize * zoom} ${viewBoxSize * zoom} ${viewBoxSize * zoom}`}
          className="w-full h-auto sm:h-full max-h-[380px] sm:max-h-none"
        >
          <defs>
            {/* Fine 10mm grid */}
            <pattern
              id={`cad-grid-10-${isDark ? 'dark' : 'light'}`}
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke={isDark ? '#1C1C1F' : '#F1F5F9'}
                strokeWidth="0.5"
              />
            </pattern>
            {/* Major 50mm grid */}
            <pattern
              id={`cad-grid-50-${isDark ? 'dark' : 'light'}`}
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke={isDark ? '#27272A' : '#E2E8F0'}
                strokeWidth="0.8"
              />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect
            x={-halfSize * 2}
            y={-halfSize * 2}
            width={viewBoxSize * 2}
            height={viewBoxSize * 2}
            fill={`url(#cad-grid-10-${isDark ? 'dark' : 'light'})`}
          />
          <rect
            x={-halfSize * 2}
            y={-halfSize * 2}
            width={viewBoxSize * 2}
            height={viewBoxSize * 2}
            fill={`url(#cad-grid-50-${isDark ? 'dark' : 'light'})`}
          />

          {/* Center Coordinate Axes */}
          <line
            x1={-halfSize * 1.5}
            y1="0"
            x2={halfSize * 1.5}
            y2="0"
            stroke={isDark ? '#52525B' : '#94A3B8'}
            strokeWidth="0.9"
            strokeDasharray="4 4"
          />
          <line
            x1="0"
            y1={-halfSize * 1.5}
            x2="0"
            y2={halfSize * 1.5}
            stroke={isDark ? '#52525B' : '#94A3B8'}
            strokeWidth="0.9"
            strokeDasharray="4 4"
          />

          {/* Grid tick marks & mm numbers */}
          {gridTicks.map((t) => (
            <g key={`tick-${t}`}>
              <line
                x1={t}
                y1="-3"
                x2={t}
                y2="3"
                stroke={isDark ? '#52525B' : '#64748B'}
                strokeWidth="0.8"
              />
              <text
                x={t}
                y="12"
                fontSize="8.5"
                fill={isDark ? '#71717A' : '#64748B'}
                textAnchor="middle"
                fontFamily="sans-serif"
                className="tabular-nums"
              >
                {t}
              </text>
              <line
                x1="-3"
                y1={t}
                x2="3"
                y2={t}
                stroke={isDark ? '#52525B' : '#64748B'}
                strokeWidth="0.8"
              />
              <text
                x="-8"
                y={t + 3}
                fontSize="8.5"
                fill={isDark ? '#71717A' : '#64748B'}
                textAnchor="end"
                fontFamily="sans-serif"
                className="tabular-nums"
              >
                {t}
              </text>
            </g>
          ))}

          {/* 1. Butt Ellipse (thin dashed contour at z = length) */}
          <ellipse
            cx="0"
            cy="0"
            rx={rxL}
            ry={ryL}
            fill={isDark ? 'rgba(39, 39, 42, 0.2)' : '#F8FAFC'}
            stroke={isDark ? '#52525B' : '#94A3B8'}
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />

          {/* 2. Top Ellipse (crisp solid line at z = 0) */}
          <ellipse
            cx="0"
            cy="0"
            rx={rx0}
            ry={ry0}
            fill={isDark ? 'rgba(24, 24, 27, 0.4)' : '#FFFFFF'}
            stroke={isDark ? '#E4E4E7' : '#334155'}
            strokeWidth="1.8"
          />

          {/* 3. Sawing Pattern (Rotated group) */}
          <g transform={`rotate(${result.rotationAngle})`}>
            {/* Cant boundary lines */}
            {result.cantThickness > 0 && (
              <>
                <line
                  x1={-rx0 * 1.05}
                  y1={-result.cantThickness / 2}
                  x2={rx0 * 1.05}
                  y2={-result.cantThickness / 2}
                  stroke={isDark ? '#3F3F46' : '#CBD5E1'}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <line
                  x1={-rx0 * 1.05}
                  y1={result.cantThickness / 2}
                  x2={rx0 * 1.05}
                  y2={result.cantThickness / 2}
                  stroke={isDark ? '#3F3F46' : '#CBD5E1'}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              </>
            )}

            {/* Boards */}
            {result.boards.map((b) => {
              const zoneStyle = getZoneStyle(b.zone);
              const isHovered = hoveredBoard?.id === b.id;
              const w = b.sawWidth;
              const h = b.sawHeight;
              const xLeft = b.x - w / 2;
              const yTop = b.y - h / 2;

              return (
                <g
                  key={b.id}
                  className="cursor-pointer"
                  onMouseEnter={(e) => updateTooltipPos(e, b)}
                  onMouseMove={(e) => updateTooltipPos(e, b)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hoveredBoard?.id === b.id) {
                      setHoveredBoard(null);
                    } else {
                      updateTooltipPos(e, b);
                    }
                  }}
                >
                  <rect
                    x={xLeft}
                    y={yTop}
                    width={w}
                    height={h}
                    rx="1"
                    fill={isHovered ? (isDark ? '#EAB308' : '#FEF08A') : zoneStyle.fill}
                    stroke={isHovered ? (isDark ? '#FFFFFF' : '#0F172A') : zoneStyle.stroke}
                    strokeWidth={isHovered ? 2.2 : 1.2}
                  />

                  {/* Clean readable label inside board - толщина × ширина везде */}
                  {(() => {
                    const nomThick = Math.min(b.nomWidth, b.nomHeight);
                    const nomW = Math.max(b.nomWidth, b.nomHeight);
                    const label = `${nomThick}×${nomW}`;

                    if (w >= h) {
                      // Horizontal board (core or 2nd pass side board)
                      if (w >= 36 && h >= 12) {
                        return (
                          <text
                            x={b.x}
                            y={b.y + 3.5}
                            fontSize={Math.min(9.5, h * 0.42)}
                            fontWeight="bold"
                            fill={isHovered && isDark ? '#000000' : zoneStyle.textColor}
                            textAnchor="middle"
                            pointerEvents="none"
                            fontFamily="sans-serif"
                          >
                            {label}
                          </text>
                        );
                      }
                    } else {
                      // Vertical board (1st pass side board)
                      if (h >= 36 && w >= 12) {
                        return (
                          <text
                            x={b.x}
                            y={b.y}
                            transform={`rotate(-90 ${b.x} ${b.y})`}
                            fontSize={Math.min(9.5, w * 0.42)}
                            fontWeight="bold"
                            fill={isHovered && isDark ? '#000000' : zoneStyle.textColor}
                            textAnchor="middle"
                            dominantBaseline="central"
                            pointerEvents="none"
                            fontFamily="sans-serif"
                          >
                            {label}
                          </text>
                        );
                      }
                    }
                    return null;
                  })()}
                </g>
              );
            })}
          </g>

          {/* Ellipse axes dimensions */}
          <text
            x={rx0 + 6}
            y="-4"
            fill={isDark ? '#D4D4D8' : '#334155'}
            fontSize="9.5"
            fontFamily="sans-serif"
            fontWeight="bold"
          >
            2rx = {Math.round(rx0 * 2)} мм
          </text>
          <text
            x="0"
            y={label2ryY}
            fill={isDark ? '#D4D4D8' : '#334155'}
            fontSize="9.5"
            fontFamily="sans-serif"
            fontWeight="bold"
            textAnchor="middle"
          >
            2ry = {Math.round(ry0 * 2)} мм
          </text>
        </svg>

        {/* Floating Tooltip in Clean Adaptive Style */}
        {hoveredBoard && tooltipPos && (
          <div
            className={`absolute z-20 pointer-events-none rounded p-2.5 shadow-lg text-xs max-w-[230px] sm:max-w-xs border transition-colors ${
              isDark
                ? 'bg-[#18181B] border-[#27272A] text-[#F4F4F5]'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
            style={{
              left: Math.max(
                8,
                Math.min(
                  tooltipPos.x + 12,
                  Math.max(8, (canvasRef.current?.clientWidth ?? 340) - 225)
                )
              ),
              top: Math.max(tooltipPos.y - 75, 10),
            }}
          >
            <div
              className={`flex items-center justify-between gap-3 pb-1 border-b font-semibold ${
                isDark ? 'border-zinc-800' : 'border-slate-100'
              }`}
            >
              <span className={isDark ? 'text-emerald-400' : 'text-emerald-800'}>
                {getZoneStyle(hoveredBoard.zone).label}
              </span>
              <span
                className={`text-[10px] font-mono ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                {hoveredBoard.zone === 'taperSide'
                  ? `z = ${hoveredBoard.zStart.toFixed(1)}–${(hoveredBoard.zStart + hoveredBoard.length).toFixed(1)} м`
                  : hoveredBoard.id}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[11px] tabular-nums">
              <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>Номинал:</span>
              <span className="font-semibold whitespace-nowrap">
                {Math.min(hoveredBoard.nomWidth, hoveredBoard.nomHeight)}×{Math.max(hoveredBoard.nomWidth, hoveredBoard.nomHeight)}×{hoveredBoard.length.toFixed(1)} м
              </span>

              <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>Пильный размер:</span>
              <span className="whitespace-nowrap">
                {Math.min(hoveredBoard.sawWidth, hoveredBoard.sawHeight).toFixed(1)}×{Math.max(hoveredBoard.sawWidth, hoveredBoard.sawHeight).toFixed(1)} мм
              </span>

              <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>Объём:</span>
              <span className="whitespace-nowrap">
                {((hoveredBoard.nomHeight * hoveredBoard.nomWidth * hoveredBoard.length) / 1_000_000).toFixed(4)} м³
              </span>

              <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>Цена:</span>
              <span className="whitespace-nowrap">
                {hoveredBoard.pricePerM3.toLocaleString('ru-RU')} ₽/м³
              </span>

              <span className={isDark ? 'text-zinc-400' : 'text-slate-500'}>Стоимость:</span>
              <span
                className={`font-bold whitespace-nowrap ${
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                }`}
              >
                {Math.round(((hoveredBoard.nomHeight * hoveredBoard.nomWidth * hoveredBoard.length) / 1_000_000) * hoveredBoard.pricePerM3).toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Blueprint Legend */}
      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 border-t text-xs transition-colors ${
          isDark
            ? 'bg-[#18181B] border-[#27272A] text-zinc-400'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-sm ${
                isDark ? 'bg-[#854D0E] border border-[#EAB308]' : 'bg-[#FDE68A] border border-[#B45309]'
              }`}
            />
            <span>Центральные ({result.boards.filter((b) => b.zone === 'core').length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-sm ${
                isDark ? 'bg-[#1E3A8A] border border-[#3B82F6]' : 'bg-[#DBEAFE] border border-[#1D4ED8]'
              }`}
            />
            <span>Боковые ({result.boards.filter((b) => b.zone === 'side').length})</span>
          </div>
          {result.boards.some((b) => b.zone === 'taperSide') && (
            <div className="flex items-center gap-1.5">
              <span
                className={`w-3 h-3 rounded-sm ${
                  isDark ? 'bg-[#14532D] border border-[#22C55E]' : 'bg-[#D1FAE5] border border-[#047857]'
                }`}
              />
              <span>Сбеговые ({result.boards.filter((b) => b.zone === 'taperSide').length})</span>
            </div>
          )}
        </div>

        <div
          className={`flex items-center gap-3 text-[11px] ${
            isDark ? 'text-zinc-500' : 'text-slate-500'
          }`}
        >
          <div className="flex items-center gap-1">
            <span
              className={`w-3.5 h-0.5 ${isDark ? 'bg-zinc-200' : 'bg-[#334155]'}`}
            />
            <span>Вершина (z=0)</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-3.5 h-0.5 border-t border-dashed ${
                isDark ? 'border-zinc-500' : 'border-[#94A3B8]'
              }`}
            />
            <span>Комель (z=L)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
