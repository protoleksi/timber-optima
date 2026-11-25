import React, { useState, useEffect, useRef } from 'react';
import {
  SimulationSummary,
  WorkerProgressMessage,
  WorkerResultMessage,
  OptimizationConfig,
} from '../engine/types';
import { generateBatch, runBatchSimulation } from '../engine/batchSimulator';
import { BYPRODUCT_PRICES, GOST_24454_SECTIONS } from '../engine/gostData';
import {
  Play,
  Activity,
  CheckCircle2,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronUp,
  Building2,
  Calculator,
  Layers,
  BarChart2,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

export const BatchSimulation: React.FC = () => {
  const { isDark } = useTheme();

  const [logCount, setLogCount] = useState<number>(1000);
  const [meanDiameter, setMeanDiameter] = useState<number>(220);
  const [stdDev, setStdDev] = useState<number>(35);
  const [seed, setSeed] = useState<number>(42);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    percent: number;
    current: number;
    total: number;
  }>({ percent: 0, current: 0, total: 0 });
  const [durationMs, setDurationMs] = useState<number>(0);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);

  // Accordion for steps 2a & 2b decomposition
  const [showDecomposition, setShowDecomposition] = useState<boolean>(true);

  // Factory annual capacity scaling (м3/год)
  const [annualRawVolume, setAnnualRawVolume] = useState<number>(100000);

  const workerRef = useRef<Worker | null>(null);
  const timerStartRef = useRef<number>(0);

  // Run initial default simulation on mount (deterministic seed 42)
  useEffect(() => {
    runSimulation(1000, 220, 35, 42);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSimulation = (
    count: number,
    mean: number,
    sigma: number,
    randSeed: number
  ) => {
    setIsRunning(true);
    setProgress({ percent: 0, current: 0, total: count });
    timerStartRef.current = performance.now();

    try {
      const worker = new Worker(
        new URL('../engine/batchWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (
        e: MessageEvent<WorkerProgressMessage | WorkerResultMessage>
      ) => {
        if (e.data.type === 'progress') {
          setProgress({
            percent: e.data.percent,
            current: e.data.current,
            total: e.data.total,
          });
        } else if (e.data.type === 'result') {
          setSummary(e.data.summary);
          setDurationMs(Math.round(performance.now() - timerStartRef.current));
          setIsRunning(false);
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = () => {
        runFallbackMainThread(count, mean, sigma, randSeed);
      };

      worker.postMessage({
        type: 'start',
        count,
        seed: randSeed,
        mean,
        stdDev: sigma,
        sections: GOST_24454_SECTIONS.map((s) => ({ ...s })),
        byproductPrices: { ...BYPRODUCT_PRICES },
      });
    } catch {
      runFallbackMainThread(count, mean, sigma, randSeed);
    }
  };

  const runFallbackMainThread = (
    count: number,
    mean: number,
    sigma: number,
    randSeed: number
  ) => {
    setTimeout(() => {
      const config: OptimizationConfig = {
        kerf: 3.6,
        useShrinkage: true,
        useTaperBoards: true,
        rotationStepDeg: 15,
        sections: GOST_24454_SECTIONS.map((s) => ({ ...s })),
      };
      const logs = generateBatch(count, randSeed, 3.6, true, true, mean, sigma);
      const res = runBatchSimulation(logs, config, randSeed, (curr, tot) => {
        setProgress({
          percent: Math.round((curr / tot) * 100),
          current: curr,
          total: tot,
        });
      });
      setSummary(res);
      setDurationMs(Math.round(performance.now() - timerStartRef.current));
      setIsRunning(false);
    }, 10);
  };

  const handleStart = () => {
    if (isRunning) return;
    runSimulation(logCount, meanDiameter, stdDev, seed);
  };

  // Export JSON Report
  const handleExportJson = () => {
    if (!summary) return;
    const jsonStr = JSON.stringify(
      {
        title: 'TimberOptima Batch Simulation Report',
        date: new Date().toISOString(),
        config: {
          logCount,
          meanDiameter,
          stdDev,
          seed,
          durationMs,
        },
        summary,
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TimberOptima_Simulation_${logCount}_logs_seed${seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV Report with fixed percentages
  const handleExportCsv = () => {
    if (!summary) return;
    const deltaValPp = summary.adaptiveValue.averageRecoveryRate - summary.baseline.averageRecoveryRate;
    const rows = [
      ['Параметр', 'Baseline', '2a. Exact D', '2b. D+Rot', '2c. Adaptive Geom', '3. Adaptive Full', '4. Adaptive Value'],
      [
        'Полезный объём (м³)',
        summary.baseline.totalNomLumberVolume.toFixed(2),
        summary.stepDiameter.totalNomLumberVolume.toFixed(2),
        summary.stepRotation.totalNomLumberVolume.toFixed(2),
        summary.adaptiveGeometry.totalNomLumberVolume.toFixed(2),
        summary.adaptiveVolume.totalNomLumberVolume.toFixed(2),
        summary.adaptiveValue.totalNomLumberVolume.toFixed(2),
      ],
      [
        'Выход пиломатериалов (%)',
        summary.baseline.averageRecoveryRate.toFixed(2),
        summary.stepDiameter.averageRecoveryRate.toFixed(2),
        summary.stepRotation.averageRecoveryRate.toFixed(2),
        summary.adaptiveGeometry.averageRecoveryRate.toFixed(2),
        summary.adaptiveVolume.averageRecoveryRate.toFixed(2),
        summary.adaptiveValue.averageRecoveryRate.toFixed(2),
      ],
      [
        'Прирост выхода к базе (п.п.)',
        '0.00',
        summary.deltaDiameterPercent.toFixed(2),
        summary.deltaRotationPercent.toFixed(2),
        summary.deltaGeometryPercent.toFixed(2),
        summary.deltaVolumePercent.toFixed(2),
        deltaValPp.toFixed(2),
      ],
      [
        'Суммарная выручка (₽)',
        Math.round(summary.baseline.totalRevenue).toString(),
        Math.round(summary.stepDiameter.totalRevenue).toString(),
        Math.round(summary.stepRotation.totalRevenue).toString(),
        Math.round(summary.adaptiveGeometry.totalRevenue).toString(),
        Math.round(summary.adaptiveVolume.totalRevenue).toString(),
        Math.round(summary.adaptiveValue.totalRevenue).toString(),
      ],
      [
        'Прирост выручки к базе (%)',
        '0.00',
        (((summary.stepDiameter.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2),
        (((summary.stepRotation.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2),
        (((summary.adaptiveGeometry.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2),
        (((summary.adaptiveVolume.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2),
        summary.deltaValuePercent.toFixed(2),
      ],
    ];

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TimberOptima_Simulation_${logCount}_logs_seed${seed}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prepare chart data for Diameter Groups
  const chartGroupData = summary
    ? summary.diameterGroups.map((g) => ({
        fullName: g.groupName,
        '1. Базовый': Number(g.baselineRecoveryRate.toFixed(1)),
        '2c. Адаптив Геом.': Number(g.adaptiveGeometryRecoveryRate.toFixed(1)),
        '3. Адаптив Полный': Number(g.adaptiveVolumeRecoveryRate.toFixed(1)),
        '4. Адаптив Выручка': Number(g.adaptiveValueRecoveryRate.toFixed(1)),
      }))
    : [];

  // Prepare chart data for Revenue Structure
  const chartRevenueData = summary
    ? [
        {
          name: '1. Baseline',
          'Пиломатериалы': Math.round(summary.baseline.lumberRevenue),
          'Техщепа': Math.round(summary.baseline.chipsRevenue),
          'Опилки': Math.round(summary.baseline.sawdustRevenue),
        },
        {
          name: '2c. Ad. Geometry',
          'Пиломатериалы': Math.round(summary.adaptiveGeometry.lumberRevenue),
          'Техщепа': Math.round(summary.adaptiveGeometry.chipsRevenue),
          'Опилки': Math.round(summary.adaptiveGeometry.sawdustRevenue),
        },
        {
          name: '3. Ad. Full (Vol)',
          'Пиломатериалы': Math.round(summary.adaptiveVolume.lumberRevenue),
          'Техщепа': Math.round(summary.adaptiveVolume.chipsRevenue),
          'Опилки': Math.round(summary.adaptiveVolume.sawdustRevenue),
        },
        {
          name: '4. Ad. Value',
          'Пиломатериалы': Math.round(summary.adaptiveValue.lumberRevenue),
          'Техщепа': Math.round(summary.adaptiveValue.chipsRevenue),
          'Опилки': Math.round(summary.adaptiveValue.sawdustRevenue),
        },
      ]
    : [];

  // Scaling calculations
  const sampleLogVol = summary ? summary.baseline.totalLogVolume : 228.64;
  const sampleDeltaLumberVol = summary
    ? summary.adaptiveValue.totalNomLumberVolume - summary.baseline.totalNomLumberVolume
    : 11.85;
  const sampleDeltaRev = summary
    ? summary.adaptiveValue.totalRevenue - summary.baseline.totalRevenue
    : 255822;

  const scaleFactor = sampleLogVol > 0 ? annualRawVolume / sampleLogVol : 0;
  const annualExtraLumberVol = Math.round(sampleDeltaLumberVol * scaleFactor);
  const annualExtraRevenueMln = ((sampleDeltaRev * scaleFactor) / 1_000_000).toFixed(2);

  const deltaValPp = summary
    ? summary.adaptiveValue.averageRecoveryRate - summary.baseline.averageRecoveryRate
    : 5.18;

  const cardCls = isDark
    ? 'bg-[#18181B] border-[#27272A]'
    : 'bg-white border-slate-200';
  const textHead = isDark ? 'text-[#F4F4F5]' : 'text-slate-900';
  const textSub = isDark ? 'text-zinc-400' : 'text-slate-500';
  const inputCls = isDark
    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-emerald-500'
    : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-700';

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${textHead}`}>
            Симуляция партии и апробация
          </h1>
          <p className={`text-xs mt-0.5 ${textSub}`}>
            Пакетное сравнение стратегий раскроя на синтетической выборке пиловочника по ГОСТ 9463-2025
          </p>
        </div>

        {/* Action Buttons: Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            disabled={!summary || isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition disabled:opacity-50 ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Download className="w-3.5 h-3.5 opacity-60" />
            <span>Экспорт JSON</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!summary || isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition disabled:opacity-50 ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Download className="w-3.5 h-3.5 opacity-60" />
            <span>Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* 1. Batch Configuration Panel */}
      <div className={`border rounded-lg p-4 shadow-none transition-colors ${cardCls}`}>
        <div className={`flex items-center justify-between pb-3 border-b mb-3 text-xs font-semibold ${isDark ? 'border-zinc-800 text-zinc-100' : 'border-slate-100 text-slate-800'}`}>
          <div className="flex items-center gap-2">
            <Layers className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
            <span>Параметры генератора партии брёвен</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Log Count */}
          <div>
            <label className={`font-medium block mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              Количество брёвен:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[100, 500, 1000].map((c) => (
                <button
                  key={c}
                  onClick={() => setLogCount(c)}
                  className={`py-1 px-2 rounded font-semibold transition text-center tabular-nums ${
                    logCount === c
                      ? isDark
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Mean Diameter */}
          <div>
            <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              <span>Средний диаметр:</span>
              <span className={`font-semibold tabular-nums ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                {meanDiameter} мм
              </span>
            </div>
            <input
              type="range"
              min={160}
              max={300}
              step={5}
              value={meanDiameter}
              onChange={(e) => setMeanDiameter(Number(e.target.value))}
              className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${isDark ? 'bg-zinc-700' : 'bg-slate-200'}`}
            />
          </div>

          {/* Std Dev */}
          <div>
            <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              <span>Разброс (сигма):</span>
              <span className={`font-semibold tabular-nums ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                ±{stdDev} мм
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={60}
              step={5}
              value={stdDev}
              onChange={(e) => setStdDev(Number(e.target.value))}
              className={`w-full accent-emerald-600 cursor-pointer h-1 rounded ${isDark ? 'bg-zinc-700' : 'bg-slate-200'}`}
            />
          </div>

          {/* Seed & Launch Button */}
          <div className="flex flex-col justify-between">
            <div className={`flex justify-between items-center mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              <span>Seed выборки:</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 42)}
                className={`w-16 px-1.5 py-0.5 text-right font-semibold text-xs rounded focus:outline-none tabular-nums ${inputCls}`}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={isRunning}
              className={`w-full py-1.5 px-3 rounded text-xs font-semibold text-white flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                isDark ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {isRunning ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  <span>Расчёт ({progress.percent}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Запустить расчёт</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className={`mt-3 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
            <div className={`flex justify-between text-xs mb-1 ${textSub}`}>
              <span>Выполняется фоновый расчёт в Web Worker...</span>
              <span className={`font-semibold tabular-nums ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                {progress.current} / {progress.total} брёвен ({progress.percent}%)
              </span>
            </div>
            <div className={`w-full h-1.5 rounded overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
              <div
                style={{ width: `${progress.percent}%` }}
                className="h-full bg-emerald-600 transition-all duration-150"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Summary Table (4 Strategies, Correct Percentages) */}
      {summary && (
        <div className={`border rounded-lg overflow-hidden shadow-none transition-colors ${cardCls}`}>
          <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`flex items-center gap-2 font-semibold ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
              <CheckCircle2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
              <span>
                Сравнение стратегий раскроя ({summary.totalLogs} брёвен, суммарный объём {summary.baseline.totalLogVolume.toFixed(2)} м³)
              </span>
            </div>
            <div className={`flex items-center gap-1.5 tabular-nums ${textSub}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>Время расчёта: {durationMs} мс</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  className={`border-b font-medium ${
                    isDark
                      ? 'bg-zinc-800/30 text-zinc-400 border-zinc-800'
                      : 'bg-slate-50/60 text-slate-500 border-slate-200'
                  }`}
                >
                  <th className="py-2.5 px-3">Стратегия раскроя</th>
                  <th className="py-2.5 px-3 text-right">Полезный объём (м³)</th>
                  <th className="py-2.5 px-3 text-right">Выход (%)</th>
                  <th className="py-2.5 px-3 text-right">Дельта выхода (п.п.)</th>
                  <th className="py-2.5 px-3 text-right">Выручка (₽)</th>
                  <th className="py-2.5 px-3 text-right">Прирост выручки (%)</th>
                  <th className="py-2.5 px-3 text-right">Абс. прирост (₽)</th>
                </tr>
              </thead>
              <tbody className={`divide-y tabular-nums ${isDark ? 'divide-zinc-800/60' : 'divide-slate-100'}`}>
                {/* 1. Baseline */}
                <tr className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50/60'}`}>
                  <td className={`py-2.5 px-3 font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    1. Baseline (Типовой постав ступени)
                  </td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {summary.baseline.totalNomLumberVolume.toFixed(2)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                    {summary.baseline.averageRecoveryRate.toFixed(2)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {Math.round(summary.baseline.totalRevenue).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                </tr>

                {/* 2c. Adaptive Geometry */}
                <tr className={`transition ${isDark ? 'hover:bg-zinc-800/40 bg-emerald-950/20' : 'hover:bg-slate-50/60 bg-emerald-50/20'}`}>
                  <td className={`py-2.5 px-3 font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                    2c. Adaptive Geometry (Геометрия под эллипс)
                  </td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                    {summary.adaptiveGeometry.totalNomLumberVolume.toFixed(2)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {summary.adaptiveGeometry.averageRecoveryRate.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    +{summary.deltaGeometryPercent.toFixed(2)} п.п.
                  </td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                    {Math.round(summary.adaptiveGeometry.totalRevenue).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    +{(((summary.adaptiveGeometry.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    +{Math.round(summary.adaptiveGeometry.totalRevenue - summary.baseline.totalRevenue).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>

                {/* 3. Adaptive Full */}
                <tr className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50/60'}`}>
                  <td className={`py-2.5 px-3 font-semibold ${isDark ? 'text-sky-400' : 'text-sky-800'}`}>
                    3. Adaptive Full (Максимум объёма + сбег)
                  </td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                    {summary.adaptiveVolume.totalNomLumberVolume.toFixed(2)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>
                    {summary.adaptiveVolume.averageRecoveryRate.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>
                    +{summary.deltaVolumePercent.toFixed(2)} п.п.
                  </td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                    {Math.round(summary.adaptiveVolume.totalRevenue).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>
                    +{(((summary.adaptiveVolume.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>
                    +{Math.round(summary.adaptiveVolume.totalRevenue - summary.baseline.totalRevenue).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>

                {/* 4. Adaptive Value */}
                <tr
                  className={`transition font-semibold border-t ${
                    isDark
                      ? 'hover:bg-zinc-800/40 bg-amber-950/20 border-amber-900/60'
                      : 'hover:bg-slate-50/60 bg-amber-50/30 border-amber-200'
                  }`}
                >
                  <td className={`py-2.5 px-3 ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                    4. Adaptive Value (Экономический оптимум выручки)
                  </td>
                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                    {summary.adaptiveValue.totalNomLumberVolume.toFixed(2)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                    {summary.adaptiveValue.averageRecoveryRate.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                    +{deltaValPp.toFixed(2)} п.п.
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                    {Math.round(summary.adaptiveValue.totalRevenue).toLocaleString('ru-RU')} ₽
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    +{summary.deltaValuePercent.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    +{Math.round(summary.deltaValueRub).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Expandable Accordion: Full Decomposition (Ablation Steps 2a & 2b) */}
      {summary && (
        <div className={`border rounded-lg overflow-hidden shadow-none transition-colors ${cardCls}`}>
          <button
            onClick={() => setShowDecomposition(!showDecomposition)}
            className={`w-full p-3.5 flex items-center justify-between text-left transition ${
              isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-xs ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                Декомпозиция факторов перехода (Ablation Study: шаги 2a и 2b)
              </span>
              <span className={`text-xs hidden sm:inline ${textSub}`}>
                — физическое обоснование эффектов
              </span>
            </div>
            {showDecomposition ? (
              <ChevronUp className="w-4 h-4 opacity-60" />
            ) : (
              <ChevronDown className="w-4 h-4 opacity-60" />
            )}
          </button>

          {showDecomposition && (
            <div className={`p-3.5 pt-0 border-t space-y-3 ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr
                      className={`border-b font-medium ${
                        isDark
                          ? 'bg-zinc-800/30 text-zinc-400 border-zinc-800'
                          : 'bg-slate-50/60 text-slate-500 border-slate-200'
                      }`}
                    >
                      <th className="py-2 px-3">Шаг перехода</th>
                      <th className="py-2 px-3 text-right">Выход (%)</th>
                      <th className="py-2 px-3 text-right">Дельта к базе (п.п.)</th>
                      <th className="py-2 px-3 text-right">Выручка (₽)</th>
                      <th className="py-2 px-3 text-right">Прирост выручки (%)</th>
                      <th className="py-2 px-3">Вероятная причина влияния</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y tabular-nums ${isDark ? 'divide-zinc-800/60' : 'divide-slate-100'}`}>
                    {/* 2a */}
                    <tr className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50/60'}`}>
                      <td className={`py-2 px-3 font-semibold ${isDark ? 'text-rose-400' : 'text-rose-800'}`}>
                        2a. Только фактический диаметр (без поворота)
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                        {summary.stepDiameter.averageRecoveryRate.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                        {summary.deltaDiameterPercent.toFixed(2)} п.п.
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                        {Math.round(summary.stepDiameter.totalRevenue).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-rose-400' : 'text-rose-700'}`}>
                        {(((summary.stepDiameter.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        Вероятная причина: типовой круговой постав рассчитан на симметричный круг; без адаптации к овалу крайние доски пересекают малую полуось и отбраковываются по обзолу.
                      </td>
                    </tr>

                    {/* 2b */}
                    <tr className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50/60'}`}>
                      <td className={`py-2 px-3 font-semibold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                        2b. Фактический диаметр + поворот овала (15°)
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        {summary.stepRotation.averageRecoveryRate.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        {summary.deltaRotationPercent.toFixed(2)} п.п.
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                        {Math.round(summary.stepRotation.totalRevenue).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        {(((summary.stepRotation.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        Вероятная причина: поворот бревна частично снижает отбраковку (+2.0 п.п. к шагу 2a), однако жёсткая круговая геометрия пакета не способна задействовать вытянутость эллипса.
                      </td>
                    </tr>

                    {/* 2c */}
                    <tr className={`transition ${isDark ? 'hover:bg-zinc-800/40 bg-emerald-950/20' : 'hover:bg-slate-50/60 bg-emerald-50/30'}`}>
                      <td className={`py-2 px-3 font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                        2c. Полная адаптация под эллипс (rx, ry)
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {summary.adaptiveGeometry.averageRecoveryRate.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        +{summary.deltaGeometryPercent.toFixed(2)} п.п.
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                        {Math.round(summary.adaptiveGeometry.totalRevenue).toLocaleString('ru-RU')} ₽
                      </td>
                      <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        +{(((summary.adaptiveGeometry.totalRevenue - summary.baseline.totalRevenue) / summary.baseline.totalRevenue) * 100).toFixed(2)}%
                      </td>
                      <td className={`py-2 px-3 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                        Вероятная причина: индивидуальный подбор толщины бруса и ширин боковых досок под обе полуоси эллипса (rx, ry) позволяет полностью задействовать дополнительную площадь сечения (+6.5 п.п. к базе).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Visual Recharts Cards (Adapts to Light / Dark Theme) */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Recovery Rate by Diameter Group */}
          <div className={`border rounded-lg p-4 shadow-none transition-colors ${cardCls}`}>
            <div className={`flex items-center justify-between pb-3 border-b mb-4 ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <BarChart2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                <span className={`font-semibold text-xs ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
                  Объёмный выход по группам диаметров (%)
                </span>
              </div>
              <span className={`text-[11px] ${textSub}`}>Сравнение 4 стратегий</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartGroupData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272A' : '#E2E8F0'} />
                  <XAxis
                    dataKey="fullName"
                    stroke={isDark ? '#A1A1AA' : '#64748B'}
                    fontSize={10.5}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={isDark ? '#A1A1AA' : '#64748B'}
                    fontSize={10.5}
                    domain={[0, 70]}
                    unit="%"
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                      borderColor: isDark ? '#27272A' : '#CBD5E1',
                      color: isDark ? '#F4F4F5' : '#0F172A',
                      borderRadius: '6px',
                      fontSize: '11px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    itemStyle={{
                      color: isDark ? '#F4F4F5' : '#0F172A',
                    }}
                    formatter={(val: unknown) => `${Number(val || 0).toFixed(1)}%`}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: '11px',
                      paddingTop: '8px',
                      color: isDark ? '#A1A1AA' : '#475569',
                    }}
                  />
                  <Bar dataKey="1. Базовый" fill={isDark ? '#52525B' : '#94A3B8'} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="2c. Адаптив Геом." fill={isDark ? '#16A34A' : '#15803D'} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="3. Адаптив Полный" fill="#0284C7" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="4. Адаптив Выручка" fill="#D97706" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Revenue Structure */}
          <div className={`border rounded-lg p-4 shadow-none transition-colors ${cardCls}`}>
            <div className={`flex items-center justify-between pb-3 border-b mb-4 ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                <span className={`font-semibold text-xs ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
                  Структура совокупной выручки (₽)
                </span>
              </div>
              <span className={`text-[11px] ${textSub}`}>Пиломатериалы и вторичная продукция</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartRevenueData}
                  margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272A' : '#E2E8F0'} />
                  <XAxis
                    dataKey="name"
                    stroke={isDark ? '#A1A1AA' : '#64748B'}
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={isDark ? '#A1A1AA' : '#64748B'}
                    fontSize={10.5}
                    domain={[0, 'auto']}
                    tickLine={false}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                      borderColor: isDark ? '#27272A' : '#CBD5E1',
                      color: isDark ? '#F4F4F5' : '#0F172A',
                      borderRadius: '6px',
                      fontSize: '11px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    itemStyle={{
                      color: isDark ? '#F4F4F5' : '#0F172A',
                    }}
                    formatter={(val: unknown) => `${Number(val || 0).toLocaleString('ru-RU')} ₽`}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: '11px',
                      paddingTop: '8px',
                      color: isDark ? '#A1A1AA' : '#475569',
                    }}
                  />
                  <Bar
                    dataKey="Пиломатериалы"
                    stackId="a"
                    fill={isDark ? '#16A34A' : '#15803D'}
                  />
                  <Bar
                    dataKey="Техщепа"
                    stackId="a"
                    fill="#EA580C"
                  />
                  <Bar
                    dataKey="Опилки"
                    stackId="a"
                    fill="#2563EB"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 5. Factory Scaling Calculator */}
      <div className={`border rounded-lg p-5 shadow-none transition-colors ${cardCls}`}>
        <div className={`flex items-center justify-between pb-3 border-b mb-4 ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <Building2 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
            <div>
              <span className={`font-semibold text-xs block ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
                Калькулятор масштабирования на годовой объём лесопильного завода
              </span>
              <span className={`text-[11px] ${textSub}`}>
                Расчёт по Стратегии 4: «Adaptive Value (Экономический оптимум выручки)» относительно базового постава (Baseline)
              </span>
            </div>
          </div>
          <Calculator className="w-4 h-4 opacity-40" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Capacity Input */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
            <div>
              <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Годовой объём сырья на распиловку:
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={5000}
                  value={annualRawVolume}
                  onChange={(e) =>
                    setAnnualRawVolume(Math.max(1000, Number(e.target.value) || 100000))
                  }
                  className={`w-full px-3 py-1.5 font-bold rounded border text-sm focus:outline-none tabular-nums ${inputCls}`}
                />
                <span className={`absolute right-3 top-1.5 text-xs ${textSub}`}>
                  м³/год
                </span>
              </div>
            </div>

            {/* Quick capacity buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {[50000, 100000, 150000, 250000].map((v) => (
                <button
                  key={v}
                  onClick={() => setAnnualRawVolume(v)}
                  className={`py-1 px-1.5 rounded text-[11px] font-semibold transition text-center tabular-nums ${
                    annualRawVolume === v
                      ? isDark
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {v / 1000} тыс. м³
                </button>
              ))}
            </div>

            <div className={`text-[11px] space-y-1 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Оценка валовой выручки на синтетической партии, не прибыль и не результат пилота.
              </p>
              <p className="italic">
                * Экстраполяция по синтетической выборке партии брёвен (ГОСТ 9463-2025 / ГОСТ 24454-80)
              </p>
            </div>
          </div>

          {/* Scaled KPI Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Additional Lumber Volume */}
            <div className={`border rounded-lg p-3.5 flex flex-col justify-between transition-colors ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Дополнительный объём пиломатериалов (Стратегия 4):
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className={`text-2xl font-bold tabular-nums whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                  +{annualExtraLumberVol.toLocaleString('ru-RU')}
                </span>
                <span className={`text-xs ${textSub}`}>м³/год</span>
              </div>
              <span className={`text-[11px] ${textSub}`}>
                Рост полезного выхода на{' '}
                <strong className={`whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  +{deltaValPp.toFixed(1)} п.п.
                </strong>{' '}
                без закупки сырья
              </span>
            </div>

            {/* Additional Annual Revenue */}
            <div className={`border rounded-lg p-3.5 flex flex-col justify-between transition-colors ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Дополнительная выручка комбината (Стратегия 4):
              </span>
              <div className="my-2 flex items-baseline gap-2">
                <span className={`text-2xl font-bold tabular-nums whitespace-nowrap ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                  +{annualExtraRevenueMln}
                </span>
                <span className={`text-xs ${textSub}`}>млн ₽/год</span>
              </div>
              <span className={`text-[11px] ${textSub}`}>
                Прирост совокупной выручки на{' '}
                <strong className={`whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  +{summary?.deltaValuePercent.toFixed(1) ?? '12.3'}%
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
