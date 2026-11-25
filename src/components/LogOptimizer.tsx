import React, { useState, useMemo } from 'react';
import { LogInput, OptimizationConfig, OptimizationMode } from '../engine/types';
import { optimizeLog, evaluateBaseline } from '../engine/sawingEngine';
import { GOST_24454_SECTIONS } from '../engine/gostData';
import { LogBlueprint } from './LogBlueprint';
import { LogKpiCards, LogBalanceAndTable } from './LogKpiPanel';
import { Sliders, Maximize2, Columns } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LogOptimizerProps {
  priceVersion: number;
}

export const LogOptimizer: React.FC<LogOptimizerProps> = ({ priceVersion }) => {
  const { isDark } = useTheme();

  // Log parameters state
  const [topDiameter, setTopDiameter] = useState<number>(210);
  const [length, setLength] = useState<number>(4.0);
  const [taper, setTaper] = useState<number>(10.0);
  const [ovality, setOvality] = useState<number>(0.90);
  const [kerf, setKerf] = useState<number>(3.6);

  // Optimization parameters state
  const [mode, setMode] = useState<OptimizationMode>('volume');
  const [useShrinkage, setUseShrinkage] = useState<boolean>(true);
  const [useTaperBoards, setUseTaperBoards] = useState<boolean>(true);

  // View state: 'single' | 'compare'
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');

  // Build log input object
  const logInput: LogInput = useMemo(() => {
    return {
      topDiameter,
      length,
      taper,
      ovality,
      kerf,
      useShrinkage,
      useTaperBoards,
    };
  }, [topDiameter, length, taper, ovality, kerf, useShrinkage, useTaperBoards]);

  const optConfig: OptimizationConfig = useMemo(() => {
    return {
      kerf,
      useShrinkage,
      useTaperBoards,
      rotationStepDeg: 15,
      sections: GOST_24454_SECTIONS.map((s) => ({ ...s })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kerf, useShrinkage, useTaperBoards, priceVersion]);

  // Compute adaptive and baseline results
  const { adaptiveResult, baselineResult } = useMemo(() => {
    const adaptive = optimizeLog(logInput, optConfig, mode);
    const baseline = evaluateBaseline(logInput, optConfig);
    return { adaptiveResult: adaptive, baselineResult: baseline };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logInput, optConfig, mode, priceVersion]);

  const handleApplyPreset = (d: number, len: number, tap: number, ov: number) => {
    setTopDiameter(d);
    setLength(len);
    setTaper(tap);
    setOvality(ov);
  };

  const cardCls = isDark
    ? 'bg-[#18181B] border-[#27272A]'
    : 'bg-white border-slate-200';
  const textHead = isDark ? 'text-[#F4F4F5]' : 'text-slate-900';
  const textSub = isDark ? 'text-zinc-400' : 'text-slate-500';
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-500'
    : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-700';
  const sliderTrackCls = isDark ? 'bg-zinc-700' : 'bg-slate-200';

  return (
    <div className="py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="mb-4 sm:mb-5">
        <h1 className={`text-lg sm:text-xl font-bold tracking-tight ${textHead}`}>
          Оптимизатор раскроя пиловочника
        </h1>
        <p className={`text-xs mt-0.5 ${textSub}`}>
          Индивидуальный подбор 2-проходного постава с брусовкой и ориентацией овала
        </p>
      </div>

      {/* 2-Column Engineering Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar: Fixed Width 320px (below results on mobile, left on lg) */}
        <aside className={`w-full lg:w-80 shrink-0 order-2 lg:order-1 border rounded-lg p-4 shadow-none space-y-4 transition-colors ${cardCls}`}>
          {/* 1. Target Objective & Rules */}
          <div className={`space-y-3 pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <label className={`text-xs font-semibold block ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              Цель оптимизации:
            </label>
            <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-lg ${isDark ? 'bg-zinc-800/80' : 'bg-slate-100'}`}>
              <button
                onClick={() => setMode('volume')}
                className={`py-1.5 px-2 rounded text-xs font-medium transition ${
                  mode === 'volume'
                    ? isDark
                      ? 'bg-zinc-700 text-emerald-400 font-semibold'
                      : 'bg-white text-emerald-800 font-semibold shadow-xs'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Макс. объёма
              </button>
              <button
                onClick={() => setMode('value')}
                className={`py-1.5 px-2 rounded text-xs font-medium transition ${
                  mode === 'value'
                    ? isDark
                      ? 'bg-zinc-700 text-emerald-400 font-semibold'
                      : 'bg-white text-emerald-800 font-semibold shadow-xs'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Макс. выручки
              </button>
            </div>

            {/* Checkboxes */}
            <div className={`space-y-2 pt-1 text-xs ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useShrinkage}
                  onChange={(e) => setUseShrinkage(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span>Усушка ГОСТ 6782.1-75</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useTaperBoards}
                  onChange={(e) => setUseTaperBoards(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span>Доски из сбега</span>
              </label>
            </div>
          </div>

          {/* 2. Geometric Parameters */}
          <div className={`space-y-3.5 pb-3 border-b text-xs ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between font-semibold">
              <div className={`flex items-center gap-1.5 ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                <Sliders className="w-3.5 h-3.5 opacity-60" />
                <span>Параметры бревна</span>
              </div>
              <span className={`text-[10px] font-normal ${textSub}`}>ГОСТ 9463</span>
            </div>

            {/* Top Diameter Slider */}
            <div>
              <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Вершинный диаметр:</span>
                <div className="flex items-center gap-1 tabular-nums">
                  <input
                    type="number"
                    min={140}
                    max={360}
                    step={1}
                    value={topDiameter}
                    onChange={(e) =>
                      setTopDiameter(
                        Math.min(360, Math.max(140, Number(e.target.value) || 140))
                      )
                    }
                    className={`w-14 px-1 py-0.5 text-right font-semibold text-xs rounded focus:outline-none ${inputCls}`}
                  />
                  <span className={textSub}>мм</span>
                </div>
              </div>
              <input
                type="range"
                min={140}
                max={360}
                step={1}
                value={topDiameter}
                onChange={(e) => setTopDiameter(Number(e.target.value))}
                className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${sliderTrackCls}`}
              />
            </div>

            {/* Length Slider */}
            <div>
              <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Длина бревна:</span>
                <div className="flex items-center gap-1 tabular-nums">
                  <input
                    type="number"
                    min={3.0}
                    max={6.0}
                    step={0.5}
                    value={length}
                    onChange={(e) =>
                      setLength(
                        Math.min(6.0, Math.max(3.0, Number(e.target.value) || 4.0))
                      )
                    }
                    className={`w-14 px-1 py-0.5 text-right font-semibold text-xs rounded focus:outline-none ${inputCls}`}
                  />
                  <span className={textSub}>м</span>
                </div>
              </div>
              <input
                type="range"
                min={3.0}
                max={6.0}
                step={0.5}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${sliderTrackCls}`}
              />
            </div>

            {/* Taper Slider */}
            <div>
              <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Сбег:</span>
                <div className="flex items-center gap-1 tabular-nums">
                  <input
                    type="number"
                    min={5.0}
                    max={25.0}
                    step={0.5}
                    value={taper}
                    onChange={(e) =>
                      setTaper(
                        Math.min(25.0, Math.max(5.0, Number(e.target.value) || 10.0))
                      )
                    }
                    className={`w-14 px-1 py-0.5 text-right font-semibold text-xs rounded focus:outline-none ${inputCls}`}
                  />
                  <span className={textSub}>мм/м</span>
                </div>
              </div>
              <input
                type="range"
                min={5.0}
                max={25.0}
                step={0.5}
                value={taper}
                onChange={(e) => setTaper(Number(e.target.value))}
                className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${sliderTrackCls}`}
              />
            </div>

            {/* Ovality Slider */}
            <div>
              <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Овальность (ry / rx):</span>
                <div className="flex items-center gap-1 tabular-nums">
                  <input
                    type="number"
                    min={0.85}
                    max={1.0}
                    step={0.01}
                    value={ovality}
                    onChange={(e) =>
                      setOvality(
                        Math.min(1.0, Math.max(0.85, Number(e.target.value) || 0.9))
                      )
                    }
                    className={`w-14 px-1 py-0.5 text-right font-semibold text-xs rounded focus:outline-none ${inputCls}`}
                  />
                </div>
              </div>
              <input
                type="range"
                min={0.85}
                max={1.0}
                step={0.01}
                value={ovality}
                onChange={(e) => setOvality(Number(e.target.value))}
                className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${sliderTrackCls}`}
              />
            </div>

            {/* Kerf Slider */}
            <div>
              <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                <span>Ширина пропила:</span>
                <div className="flex items-center gap-1 tabular-nums">
                  <input
                    type="number"
                    min={2.5}
                    max={5.0}
                    step={0.1}
                    value={kerf}
                    onChange={(e) =>
                      setKerf(
                        Math.min(5.0, Math.max(2.5, Number(e.target.value) || 3.6))
                      )
                    }
                    className={`w-14 px-1 py-0.5 text-right font-semibold text-xs rounded focus:outline-none ${inputCls}`}
                  />
                  <span className={textSub}>мм</span>
                </div>
              </div>
              <input
                type="range"
                min={2.5}
                max={5.0}
                step={0.1}
                value={kerf}
                onChange={(e) => setKerf(Number(e.target.value))}
                className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${sliderTrackCls}`}
              />
            </div>
          </div>

          {/* 3. Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${textSub}`}>
              Быстрые сценарии:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleApplyPreset(160, 4.0, 8.0, 1.00)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left transition truncate ${
                  isDark
                    ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Тонкомер 160 мм
              </button>
              <button
                onClick={() => handleApplyPreset(210, 4.0, 10.0, 0.90)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left transition truncate ${
                  isDark
                    ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Средний 210 мм
              </button>
              <button
                onClick={() => handleApplyPreset(260, 5.0, 12.0, 0.92)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left transition truncate ${
                  isDark
                    ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Пиловочник 260 мм
              </button>
              <button
                onClick={() => handleApplyPreset(320, 6.0, 12.0, 0.95)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium border text-left transition truncate ${
                  isDark
                    ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Крупный 320 мм
              </button>
            </div>
          </div>
        </aside>

        {/* Right Work Area: Flex 1 (first on mobile for immediate blueprint/KPI view) */}
        <section className="w-full flex-1 min-w-0 order-1 lg:order-2 space-y-5">
          {/* 1. Top Row: 4 Spacious KPI Cards */}
          <LogKpiCards
            currentResult={adaptiveResult}
            baselineResult={baselineResult}
            useShrinkage={useShrinkage}
          />

          {/* 2. Center: Blueprint Card with View Switcher in Card Header */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Торцевой срез бревна
              </span>
              <div
                className={`flex flex-wrap items-center gap-1 p-0.5 rounded border ${
                  isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  onClick={() => setViewMode('single')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                    viewMode === 'single'
                      ? isDark
                        ? 'bg-zinc-700 text-white'
                        : 'bg-white text-slate-900 shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Один чертёж</span>
                </button>
                <button
                  onClick={() => setViewMode('compare')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                    viewMode === 'compare'
                      ? isDark
                        ? 'bg-zinc-700 text-white'
                        : 'bg-white text-slate-900 shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Сравнение: Базовый vs Адаптивный</span>
                </button>
              </div>
            </div>

            {viewMode === 'single' ? (
              <LogBlueprint
                title="Адаптивный оптимальный раскрой"
                result={adaptiveResult}
                log={logInput}
                badge={`Выход: ${adaptiveResult.balance.lumberRecoveryRate.toFixed(1)}%`}
                badgeColor={
                  isDark
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LogBlueprint
                  title="1. Базовый типовой постав"
                  result={baselineResult}
                  log={logInput}
                  badge={`База: ${baselineResult.balance.lumberRecoveryRate.toFixed(1)}%`}
                  badgeColor={
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }
                />
                <LogBlueprint
                  title="2. Адаптивный постав"
                  result={adaptiveResult}
                  log={logInput}
                  badge={`Адаптив: ${adaptiveResult.balance.lumberRecoveryRate.toFixed(1)}%`}
                  badgeColor={
                    isDark
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }
                />
              </div>
            )}
          </div>

          {/* 3. Below Blueprint: 4-Segment Balance & Full-Width Table */}
          <LogBalanceAndTable
            currentResult={adaptiveResult}
            baselineResult={baselineResult}
            useShrinkage={useShrinkage}
          />
        </section>
      </div>
    </div>
  );
};
