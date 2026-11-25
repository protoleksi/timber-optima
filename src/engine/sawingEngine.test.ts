/**
 * TimberOptima - Модульные тесты расчётного ядра, верификация качества и бенчмарки
 */

import { describe, it, expect } from 'vitest';
import { LogInput, OptimizationConfig } from './types';
import {
  isBoardInscribed,
  doBoardsOverlap,
  getCrossSectionRadii,
} from './geometry';
import {
  evaluateBaseline,
  applyPatternToLog,
  optimizeLog,
} from './sawingEngine';
import {
  getCylinderBaselineYields,
  getOptimalCircleEntry,
} from './baselineTables';
import {
  generateBatch,
  runBatchSimulation,
  createMulberry32,
  generateNormal,
} from './batchSimulator';
import { referenceOptimize } from './referenceOptimizer';
import {
  applyPricePreset,
  resetGostSections,
  GOST_24454_SECTIONS,
  isSectionActive,
  updateGostSection,
} from './gostData';

describe('TimberOptima Sawing Engine Unit Tests', () => {
  const defaultConfig: OptimizationConfig = {
    kerf: 3.6,
    useShrinkage: true,
    useTaperBoards: true,
    rotationStepDeg: 15,
  };

  it('1. Базовые типовые поставы на идеально круглых брёвнах (ovality = 1, taper = 0) по ступеням 140–420 мм', () => {
    resetGostSections();
    const cylConfig: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: false,
      rotationStepDeg: 15,
      sections: GOST_24454_SECTIONS.map((s) => ({ ...s })),
    };
    const yields = getCylinderBaselineYields(cylConfig);

    const compareRows = yields.map((y) => {
      const cylLog: LogInput = {
        topDiameter: y.diameter,
        length: 4.0,
        taper: 0,
        ovality: 1.0,
        kerf: 3.6,
        useShrinkage: true,
        useTaperBoards: false,
      };
      const baseRes = evaluateBaseline(cylLog, cylConfig);
      const refRes = referenceOptimize(cylLog, cylConfig, 'volume');
      const baseYield = baseRes.balance.lumberRecoveryRate;
      const refYield = refRes.balance.lumberRecoveryRate;
      const diff = Math.abs(baseYield - refYield);

      return {
        diameter: y.diameter,
        cantThickness: y.cantThickness,
        coreSpec: y.coreSpec,
        p2Count: y.p2Count,
        p1Count: y.p1Count,
        baseYield,
        refYield,
        diff,
      };
    });

    console.log('\n================================================================================================');
    console.log('🌲 ВЫХОД БАЗОВЫХ ПОСТАВОВ НА ИДЕАЛЬНО КРУГЛЫХ БРЁВНАХ VS REFERENCE (OVALITY = 1.0, TAPER = 0)');
    console.log('================================================================================================');

    console.table(
      compareRows.map((r) => ({
        'Ступень диаметра': `${r.diameter} мм`,
        'Толщина бруса': `${r.cantThickness} мм`,
        'Центральный пакет': r.coreSpec,
        'Боковые 2-го прохода': `${r.p2Count} пар(ы)`,
        'Боковые 1-го прохода': `${r.p1Count} пар(ы)`,
        'Выход базы (%)': `${r.baseYield.toFixed(4)}%`,
        'Выход эталона (%)': `${r.refYield.toFixed(4)}%`,
        'Разница (п.п.)': r.diff.toFixed(6),
      }))
    );
    console.log('================================================================================================\n');

    expect(yields.length).toBe(15);
    for (const r of compareRows) {
      expect(r.diff).toBeLessThanOrEqual(1e-4);
    }
  });

  it('2. Геометрические инварианты: 4 угла внутри эллипса, непересечение досок, баланс сырья 100%', () => {
    const testLogs: LogInput[] = [
      {
        topDiameter: 160,
        length: 4.0,
        taper: 8,
        ovality: 0.95,
        kerf: 3.6,
        useShrinkage: true,
        useTaperBoards: true,
      },
      {
        topDiameter: 200,
        length: 5.0,
        taper: 9,
        ovality: 0.92,
        kerf: 3.6,
        useShrinkage: true,
        useTaperBoards: true,
      },
      {
        topDiameter: 260,
        length: 6.0,
        taper: 10,
        ovality: 0.88,
        kerf: 3.6,
        useShrinkage: true,
        useTaperBoards: true,
      },
      {
        topDiameter: 340,
        length: 6.0,
        taper: 12,
        ovality: 1.0,
        kerf: 3.6,
        useShrinkage: false,
        useTaperBoards: true,
      },
    ];

    for (const log of testLogs) {
      const baseResult = evaluateBaseline(log, defaultConfig);
      const optResult = optimizeLog(log, defaultConfig, 'volume');

      for (const res of [baseResult, optResult]) {
        // 1. Все 4 угла внутри эллипса
        for (const b of res.boards) {
          const inscribed = isBoardInscribed(b, log, res.rotationAngle);
          expect(inscribed).toBe(true);

          const { rx, ry } = getCrossSectionRadii(
            b.zStart,
            log.topDiameter,
            log.ovality,
            log.taper
          );
          const hw = b.sawWidth / 2;
          const hh = b.sawHeight / 2;
          const corners = [
            { x: b.x - hw, y: b.y - hh },
            { x: b.x - hw, y: b.y + hh },
            { x: b.x + hw, y: b.y - hh },
            { x: b.x + hw, y: b.y + hh },
          ];

          const rad = (res.rotationAngle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          for (const c of corners) {
            const xr = c.x * cos - c.y * sin;
            const yr = c.x * sin + c.y * cos;
            const val = (xr * xr) / (rx * rx) + (yr * yr) / (ry * ry);
            expect(val).toBeLessThanOrEqual(1.0 + 1e-7);
          }
        }

        // 2. Непересечение досок
        const boards = res.boards;
        for (let i = 0; i < boards.length; i++) {
          for (let j = i + 1; j < boards.length; j++) {
            const overlap = doBoardsOverlap(boards[i], boards[j], defaultConfig.kerf);
            expect(overlap).toBe(false);
          }
        }

        // 3. Баланс сырья сходится к 100%
        const bal = res.balance;
        const sum = bal.rawBoardsVolume + bal.sawdustVolume + bal.chipsVolume;
        expect(bal.balanceError).toBeLessThan(1e-6);
        expect(Math.abs(bal.logVolume - sum)).toBeLessThan(1e-6);
      }
    }
  });

  it('3. Декомпозиция Adaptive Geometry и полный Ablation Study (1 000 брёвен, seed = 42)', () => {
    const seed = 42;
    const count = 1000;
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    const startTime = performance.now();
    const logs = generateBatch(count, seed, config.kerf, true, true);
    const summary = runBatchSimulation(logs, config, seed);
    const durationMs = Math.round(performance.now() - startTime);

    const b = summary.baseline;
    const sd = summary.stepDiameter;
    const sr = summary.stepRotation;
    const ag = summary.adaptiveGeometry;
    const av = summary.adaptiveVolume;
    const aval = summary.adaptiveValue;

    console.log('\n========================================================================================================================');
    console.log(`🌲 TIMBEROPTIMA: ДЕКОМПОЗИЦИЯ И ABLATION STUDY (ПАРТИЯ: ${count} БРЁВЕН, SEED: ${seed})`);
    console.log(`⏱ Время расчёта (1 000 брёвен × 6 стратегий = 6 000 раскроев): ${durationMs} мс`);
    console.log('========================================================================================================================');

    const metricsTable = [
      {
        'Показатель': 'Общий объём пиловочника (м³)',
        '1. Baseline': b.totalLogVolume.toFixed(2),
        '2a. Exact Diameter': sd.totalLogVolume.toFixed(2),
        '2b. Exact D + Rotation': sr.totalLogVolume.toFixed(2),
        '2c. Adaptive Geometry': ag.totalLogVolume.toFixed(2),
        '3. Adaptive Full (Vol)': av.totalLogVolume.toFixed(2),
        '4. Adaptive Value': aval.totalLogVolume.toFixed(2),
      },
      {
        'Показатель': 'Полезный объём пиломатериалов (м³)',
        '1. Baseline': b.totalNomLumberVolume.toFixed(2),
        '2a. Exact Diameter': sd.totalNomLumberVolume.toFixed(2),
        '2b. Exact D + Rotation': sr.totalNomLumberVolume.toFixed(2),
        '2c. Adaptive Geometry': ag.totalNomLumberVolume.toFixed(2),
        '3. Adaptive Full (Vol)': av.totalNomLumberVolume.toFixed(2),
        '4. Adaptive Value': aval.totalNomLumberVolume.toFixed(2),
      },
      {
        'Показатель': 'Средний объёмный выход пиломатериалов (%)',
        '1. Baseline': `${b.averageRecoveryRate.toFixed(2)}%`,
        '2a. Exact Diameter': `${sd.averageRecoveryRate.toFixed(2)}%`,
        '2b. Exact D + Rotation': `${sr.averageRecoveryRate.toFixed(2)}%`,
        '2c. Adaptive Geometry': `${ag.averageRecoveryRate.toFixed(2)}%`,
        '3. Adaptive Full (Vol)': `${av.averageRecoveryRate.toFixed(2)}%`,
        '4. Adaptive Value': `${aval.averageRecoveryRate.toFixed(2)}%`,
      },
      {
        'Показатель': 'Прирост выхода к Baseline (п.п.)',
        '1. Baseline': '—',
        '2a. Exact Diameter': `+${(sd.averageRecoveryRate - b.averageRecoveryRate).toFixed(2)} п.п.`,
        '2b. Exact D + Rotation': `+${(sr.averageRecoveryRate - b.averageRecoveryRate).toFixed(2)} п.п.`,
        '2c. Adaptive Geometry': `+${(ag.averageRecoveryRate - b.averageRecoveryRate).toFixed(2)} п.п.`,
        '3. Adaptive Full (Vol)': `+${(av.averageRecoveryRate - b.averageRecoveryRate).toFixed(2)} п.п.`,
        '4. Adaptive Value': `+${(aval.averageRecoveryRate - b.averageRecoveryRate).toFixed(2)} п.п.`,
      },
      {
        'Показатель': 'ИТОГОВАЯ СУММАРНАЯ ВЫРУЧКА (₽)',
        '1. Baseline': Math.round(b.totalRevenue).toLocaleString('ru-RU') + ' ₽',
        '2a. Exact Diameter': Math.round(sd.totalRevenue).toLocaleString('ru-RU') + ' ₽',
        '2b. Exact D + Rotation': Math.round(sr.totalRevenue).toLocaleString('ru-RU') + ' ₽',
        '2c. Adaptive Geometry': Math.round(ag.totalRevenue).toLocaleString('ru-RU') + ' ₽',
        '3. Adaptive Full (Vol)': Math.round(av.totalRevenue).toLocaleString('ru-RU') + ' ₽',
        '4. Adaptive Value': Math.round(aval.totalRevenue).toLocaleString('ru-RU') + ' ₽',
      },
      {
        'Показатель': 'Прирост выручки к Baseline (%)',
        '1. Baseline': '—',
        '2a. Exact Diameter': `+${(((sd.totalRevenue - b.totalRevenue) / b.totalRevenue) * 100).toFixed(2)}%`,
        '2b. Exact D + Rotation': `+${(((sr.totalRevenue - b.totalRevenue) / b.totalRevenue) * 100).toFixed(2)}%`,
        '2c. Adaptive Geometry': `+${(((ag.totalRevenue - b.totalRevenue) / b.totalRevenue) * 100).toFixed(2)}%`,
        '3. Adaptive Full (Vol)': `+${(((av.totalRevenue - b.totalRevenue) / b.totalRevenue) * 100).toFixed(2)}%`,
        '4. Adaptive Value': `+${(((aval.totalRevenue - b.totalRevenue) / b.totalRevenue) * 100).toFixed(2)}%`,
      },
    ];

    console.table(metricsTable);

    console.log('\n--- РАЗБИВКА ПО ГРУППАМ ДИАМЕТРОВ ПИЛОВОЧНИКА ---');
    const groupTable = summary.diameterGroups.map((g) => ({
      'Группа диаметра': g.groupName,
      'Кол-во': g.count,
      'Выход Baseline': `${g.baselineRecoveryRate.toFixed(2)}%`,
      '2a. Exact D': `${g.stepDiameterRecoveryRate.toFixed(2)}%`,
      '2b. Exact D + Rot': `${g.stepRotationRecoveryRate.toFixed(2)}%`,
      '2c. Ad. Geometry': `${g.adaptiveGeometryRecoveryRate.toFixed(2)}%`,
      '3. Ad. Full': `${g.adaptiveVolumeRecoveryRate.toFixed(2)}%`,
      '4. Ad. Value': `${g.adaptiveValueRecoveryRate.toFixed(2)}%`,
      'Выручка Baseline': `${Math.round(g.baselineRevenue).toLocaleString('ru-RU')} ₽`,
      'Выручка Ad. Value': `${Math.round(g.adaptiveValueRevenue).toLocaleString('ru-RU')} ₽`,
    }));
    console.table(groupTable);
    console.log('========================================================================================================================\n');

    expect(summary.totalLogs).toBe(1000);
    expect(aval.totalRevenue).toBeGreaterThan(b.totalRevenue);
    expect(av.averageRecoveryRate).toBeGreaterThanOrEqual(b.averageRecoveryRate);
    expect(durationMs).toBeLessThan(5000);
  }, 10000);

  it('4. Проверка качества отсечений optimizeLog против эталонного referenceOptimize (100 брёвен, seed = 42)', () => {
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    const logs = generateBatch(100, 42, config.kerf, true, true);

    let worseVolumeCount = 0;
    let maxVolumeLossPct = 0;
    let totalVolumeLossPct = 0;

    let worseValueCount = 0;
    let maxValueLossPct = 0;
    let totalValueLossPct = 0;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Volume mode
      const fastVol = optimizeLog(log, config, 'volume');
      const refVol = referenceOptimize(log, config, 'volume');

      const refVolVal = refVol.balance.nomBoardsVolume;
      const fastVolVal = fastVol.balance.nomBoardsVolume;

      if (fastVolVal < refVolVal - 1e-6) {
        worseVolumeCount++;
        const lossPct = ((refVolVal - fastVolVal) / refVolVal) * 100;
        if (lossPct > maxVolumeLossPct) maxVolumeLossPct = lossPct;
        totalVolumeLossPct += lossPct;
      }

      // Value mode
      const fastVal = optimizeLog(log, config, 'value');
      const refVal = referenceOptimize(log, config, 'value');

      const refValRev = refVal.totalRevenue;
      const fastValRev = fastVal.totalRevenue;

      if (fastValRev < refValRev - 1e-4) {
        worseValueCount++;
        const lossPct = ((refValRev - fastValRev) / refValRev) * 100;
        if (lossPct > maxValueLossPct) maxValueLossPct = lossPct;
        totalValueLossPct += lossPct;
      }
    }

    const avgVolumeLossPct = totalVolumeLossPct / logs.length;
    const avgValueLossPct = totalValueLossPct / logs.length;

    console.log('\n================================================================================================');
    console.log('🌲 ВЕРИФИКАЦИЯ КАЧЕСТВА ОТСЕЧЕНИЙ: optimizeLog vs referenceOptimize (100 брёвен)');
    console.log('================================================================================================');

    const compareTable = [
      {
        'Режим оптимизации': 'Volume (полезный объём, м³)',
        'Хуже эталона (брёвен из 100)': worseVolumeCount,
        'Максимальная потеря (%)': `${maxVolumeLossPct.toFixed(4)}%`,
        'Средняя потеря (%)': `${avgVolumeLossPct.toFixed(4)}%`,
        'Порог допустимости': 'Макс <= 0.10%, Средняя <= 0.02%',
        'Статус': maxVolumeLossPct <= 0.1 && avgVolumeLossPct <= 0.02 ? '✓ ПРОЙДЕН' : '✗ ПРЕВЫШЕН',
      },
      {
        'Режим оптимизации': 'Value (суммарная выручка, ₽)',
        'Хуже эталона (брёвен из 100)': worseValueCount,
        'Максимальная потеря (%)': `${maxValueLossPct.toFixed(4)}%`,
        'Средняя потеря (%)': `${avgValueLossPct.toFixed(4)}%`,
        'Порог допустимости': 'Макс <= 0.10%, Средняя <= 0.02%',
        'Статус': maxValueLossPct <= 0.1 && avgValueLossPct <= 0.02 ? '✓ ПРОЙДЕН' : '✗ ПРЕВЫШЕН',
      },
    ];

    console.table(compareTable);
    console.log('================================================================================================\n');

    expect(maxVolumeLossPct).toBeLessThanOrEqual(0.1);
    expect(avgVolumeLossPct).toBeLessThanOrEqual(0.02);
    expect(maxValueLossPct).toBeLessThanOrEqual(0.1);
    expect(avgValueLossPct).toBeLessThanOrEqual(0.02);
  }, 120000);

  it('5. Шаг 2a на партии с овальностью ровно 1.0 (1 000 брёвен, seed = 42)', () => {
    const seed = 42;
    const count = 1000;
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    // Генерируем выборку с овальностью ровно 1.0 (идеально круглые брёвна)
    const rawLogs = generateBatch(count, seed, config.kerf, true, true);
    const roundLogs = rawLogs.map((log) => ({
      ...log,
      ovality: 1.0,
    }));

    const summary = runBatchSimulation(roundLogs, config, seed);

    const baseRecovery = summary.baseline.averageRecoveryRate;
    const step2aRecovery = summary.stepDiameter.averageRecoveryRate;
    const deltaPp = step2aRecovery - baseRecovery;

    const baseVol = summary.baseline.totalNomLumberVolume;
    const step2aVol = summary.stepDiameter.totalNomLumberVolume;
    const deltaVol = step2aVol - baseVol;

    const baseRev = summary.baseline.totalRevenue;
    const step2aRev = summary.stepDiameter.totalRevenue;
    const deltaRev = step2aRev - baseRev;
    const deltaRevPct = ((deltaRev / baseRev) * 100);

    console.log('\n================================================================================================');
    console.log(`🌲 ШАГ 2a НА ПАРТИИ С ОВАЛЬНОСТЬЮ РОВНО 1.0 (КРУГЛЫЕ БРЁВНА, ${count} ШТ, SEED = ${seed})`);
    console.log('================================================================================================');

    const tableData = [
      {
        'Показатель': 'Средний объёмный выход (%)',
        '1. Baseline': `${baseRecovery.toFixed(2)}%`,
        '2a. Exact Diameter': `${step2aRecovery.toFixed(2)}%`,
        'Дельта (2a - Baseline)': `${deltaPp >= 0 ? '+' : ''}${deltaPp.toFixed(2)} п.п.`,
      },
      {
        'Показатель': 'Полезный объём пиломатериалов (м³)',
        '1. Baseline': `${baseVol.toFixed(2)} м³`,
        '2a. Exact Diameter': `${step2aVol.toFixed(2)} м³`,
        'Дельта (2a - Baseline)': `${deltaVol >= 0 ? '+' : ''}${deltaVol.toFixed(2)} м³`,
      },
      {
        'Показатель': 'Совокупная выручка (₽)',
        '1. Baseline': `${Math.round(baseRev).toLocaleString('ru-RU')} ₽`,
        '2a. Exact Diameter': `${Math.round(step2aRev).toLocaleString('ru-RU')} ₽`,
        'Дельта (2a - Baseline)': `${deltaRev >= 0 ? '+' : ''}${Math.round(deltaRev).toLocaleString('ru-RU')} ₽ (${deltaRevPct >= 0 ? '+' : ''}${deltaRevPct.toFixed(2)}%)`,
      },
    ];

    console.table(tableData);
    console.log('================================================================================================\n');

    expect(summary.totalLogs).toBe(1000);
    expect(roundLogs.every((l) => l.ovality === 1.0)).toBe(true);
    expect(step2aRecovery).toBeGreaterThanOrEqual(baseRecovery - 0.5);
  }, 10000);

  it('6. Анализ чувствительности (Sensitivity Analysis) на Пресете 1 (1 000 брёвен, seed = 42)', () => {
    resetGostSections();
    const count = 1000;
    const seed = 42;
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    function evaluateCustom(
      log: LogInput,
      stepSize: number,
      rule: 'floor' | 'gostRound',
      useMeanD: boolean
    ) {
      const targetD = useMeanD ? (log.topDiameter * (1 + log.ovality)) / 2 : log.topDiameter;
      const rounded = rule === 'floor'
        ? Math.floor(targetD / stepSize) * stepSize
        : Math.round(targetD / stepSize) * stepSize;
      const stepD = Math.min(420, Math.max(140, rounded));
      const entry = getOptimalCircleEntry(stepD, config);
      return applyPatternToLog(entry, log, config, 0, 'CustomBaseline');
    }

    function runVariant(
      logs: LogInput[],
      evalBaselineFn: (log: LogInput) => any
    ) {
      let bNomVol = 0, bTotVol = 0, bRev = 0;
      let aNomVol = 0, aTotVol = 0, aRev = 0;

      for (const log of logs) {
        const bRes = evalBaselineFn(log);
        bNomVol += bRes.balance.nomBoardsVolume;
        bTotVol += bRes.balance.logVolume;
        bRev += bRes.totalRevenue;

        const aRes = optimizeLog(log, config, 'volume');
        aNomVol += aRes.balance.nomBoardsVolume;
        aTotVol += aRes.balance.logVolume;
        aRev += aRes.totalRevenue;
      }

      const bYield = (bNomVol / bTotVol) * 100;
      const aYield = (aNomVol / aTotVol) * 100;
      const deltaPp = aYield - bYield;
      const revGainPct = ((aRev - bRev) / bRev) * 100;

      return {
        bYield: bYield.toFixed(2) + '%',
        aYield: aYield.toFixed(2) + '%',
        deltaPp: (deltaPp >= 0 ? '+' : '') + deltaPp.toFixed(2) + ' п.п.',
        revGainPct: (revGainPct >= 0 ? '+' : '') + revGainPct.toFixed(2) + '%',
      };
    }

    const baseLogs = generateBatch(count, seed, config.kerf, true, true);

    console.log('\n================================================================================================');
    console.log(`🌲 АНАЛИЗ ЧУВСТВИТЕЛЬНОСТИ: СТУПЕНЬ, ПРАВИЛО, СРЕДНИЙ D, ОВАЛЬНОСТЬ, СБЕГ (1 000 БРЁВЕН)`);
    console.log('================================================================================================');

    // а) Ступень Baseline: 10 / 20 / 40 мм
    const resA10 = runVariant(baseLogs, (l) => evaluateCustom(l, 10, 'floor', false));
    const resA20 = runVariant(baseLogs, (l) => evaluateCustom(l, 20, 'floor', false));
    const resA40 = runVariant(baseLogs, (l) => evaluateCustom(l, 40, 'floor', false));

    // б) Правило ступени: floor vs ГОСТ 32594
    const resBFloor = resA20;
    const resBGost = runVariant(baseLogs, (l) => evaluateCustom(l, 20, 'gostRound', false));

    // в) Ступень по среднему диаметру двух осей
    const resCMaxAxis = resA20;
    const resCMeanAxis = runVariant(baseLogs, (l) => evaluateCustom(l, 20, 'floor', true));

    // г) Овальность: 0.85–1.0 / 0.92–1.0 / ровно 1.0 (независимые сиды PRNG)
    function makeOvalLogs(minOv: number, maxOv: number, customSeed: number) {
      const prng = createMulberry32(customSeed);
      return baseLogs.map((l) => ({
        ...l,
        ovality: minOv === maxOv ? minOv : Math.round((minOv + prng() * (maxOv - minOv)) * 1000) / 1000,
      }));
    }
    const logsOv85 = makeOvalLogs(0.85, 1.0, seed + 101);
    const logsOv92 = makeOvalLogs(0.92, 1.0, seed + 202);
    const logsOv100 = makeOvalLogs(1.0, 1.0, seed);

    const resDOv85 = runVariant(logsOv85, (l) => evaluateCustom(l, 20, 'floor', false));
    const resDOv92 = runVariant(logsOv92, (l) => evaluateCustom(l, 20, 'floor', false));
    const resDOv100 = runVariant(logsOv100, (l) => evaluateCustom(l, 20, 'floor', false));

    // Контроль ступеней 10 / 20 / 40 мм на идеально круглых брёвнах (ovality = 1.0)
    const resRoundA10 = runVariant(logsOv100, (l) => evaluateCustom(l, 10, 'floor', false));
    const resRoundA20 = resDOv100;
    const resRoundA40 = runVariant(logsOv100, (l) => evaluateCustom(l, 40, 'floor', false));

    // д) Сбег: 5–7 / 7–11 (baseLogs) / 11–14 мм/м и формула (11) ГОСТ 32594 (независимые сиды)
    function makeTaperLogs(minT: number, maxT: number, customSeed: number) {
      const prng = createMulberry32(customSeed);
      return baseLogs.map((l) => ({
        ...l,
        taper: Math.round((minT + prng() * (maxT - minT)) * 10) / 10,
      }));
    }
    const logsT5_7 = makeTaperLogs(5.0, 7.0, seed + 303);
    const logsT7_11 = baseLogs;
    const logsT11_14 = makeTaperLogs(11.0, 14.0, seed + 404);

    // Формула (11) ГОСТ 32594 с шумом sigma = 2 мм/м
    const prngGost = createMulberry32(seed + 505);
    const logsTGost11 = baseLogs.map((l) => {
      const dCm = l.topDiameter / 10;
      const sCmM = 2.889 + 0.0987 * dCm - 0.8664 * Math.sqrt(dCm);
      const sMmM = sCmM * 10;
      const noise = generateNormal(prngGost, 0, 2.0);
      const taper = Math.max(2.0, Math.round((sMmM + noise) * 10) / 10);
      return { ...l, taper };
    });

    const resDT5_7 = runVariant(logsT5_7, (l) => evaluateCustom(l, 20, 'floor', false));
    const resDT7_11 = runVariant(logsT7_11, (l) => evaluateCustom(l, 20, 'floor', false));
    const resDT11_14 = runVariant(logsT11_14, (l) => evaluateCustom(l, 20, 'floor', false));
    const resDTGost = runVariant(logsTGost11, (l) => evaluateCustom(l, 20, 'floor', false));

    const sensitivityTable = [
      { 'Фактор': 'а) Ступень 10 мм', 'Baseline (%)': resA10.bYield, 'Adaptive (%)': resA10.aYield, 'Дельта (п.п.)': resA10.deltaPp, 'Прирост выручки (%)': resA10.revGainPct },
      { 'Фактор': 'а) Ступень 20 мм (стандарт)', 'Baseline (%)': resA20.bYield, 'Adaptive (%)': resA20.aYield, 'Дельта (п.п.)': resA20.deltaPp, 'Прирост выручки (%)': resA20.revGainPct },
      { 'Фактор': 'а) Ступень 40 мм', 'Baseline (%)': resA40.bYield, 'Adaptive (%)': resA40.aYield, 'Дельта (п.п.)': resA40.deltaPp, 'Прирост выручки (%)': resA40.revGainPct },
      { 'Фактор': 'а-контр.) Ступень 10 мм (ovality = 1.0)', 'Baseline (%)': resRoundA10.bYield, 'Adaptive (%)': resRoundA10.aYield, 'Дельта (п.п.)': resRoundA10.deltaPp, 'Прирост выручки (%)': resRoundA10.revGainPct },
      { 'Фактор': 'а-контр.) Ступень 20 мм (ovality = 1.0)', 'Baseline (%)': resRoundA20.bYield, 'Adaptive (%)': resRoundA20.aYield, 'Дельта (п.п.)': resRoundA20.deltaPp, 'Прирост выручки (%)': resRoundA20.revGainPct },
      { 'Фактор': 'а-контр.) Ступень 40 мм (ovality = 1.0)', 'Baseline (%)': resRoundA40.bYield, 'Adaptive (%)': resRoundA40.aYield, 'Дельта (п.п.)': resRoundA40.deltaPp, 'Прирост выручки (%)': resRoundA40.revGainPct },
      { 'Фактор': 'б) Правило: Floor (вниз)', 'Baseline (%)': resBFloor.bYield, 'Adaptive (%)': resBFloor.aYield, 'Дельта (п.п.)': resBFloor.deltaPp, 'Прирост выручки (%)': resBFloor.revGainPct },
      { 'Фактор': 'б) Правило: ГОСТ 32594 п. 4.2.2', 'Baseline (%)': resBGost.bYield, 'Adaptive (%)': resBGost.aYield, 'Дельта (п.п.)': resBGost.deltaPp, 'Прирост выручки (%)': resBGost.revGainPct },
      { 'Фактор': 'в) Ступень: по макс. оси 2rx', 'Baseline (%)': resCMaxAxis.bYield, 'Adaptive (%)': resCMaxAxis.aYield, 'Дельта (п.п.)': resCMaxAxis.deltaPp, 'Прирост выручки (%)': resCMaxAxis.revGainPct },
      { 'Фактор': 'в) Ступень: по среднему (2rx+2ry)/2', 'Baseline (%)': resCMeanAxis.bYield, 'Adaptive (%)': resCMeanAxis.aYield, 'Дельта (п.п.)': resCMeanAxis.deltaPp, 'Прирост выручки (%)': resCMeanAxis.revGainPct },
      { 'Фактор': 'г) Овальность: 0.85–1.0', 'Baseline (%)': resDOv85.bYield, 'Adaptive (%)': resDOv85.aYield, 'Дельта (п.п.)': resDOv85.deltaPp, 'Прирост выручки (%)': resDOv85.revGainPct },
      { 'Фактор': 'г) Овальность: 0.92–1.0', 'Baseline (%)': resDOv92.bYield, 'Adaptive (%)': resDOv92.aYield, 'Дельта (п.п.)': resDOv92.deltaPp, 'Прирост выручки (%)': resDOv92.revGainPct },
      { 'Фактор': 'г) Овальность: ровно 1.0', 'Baseline (%)': resDOv100.bYield, 'Adaptive (%)': resDOv100.aYield, 'Дельта (п.п.)': resDOv100.deltaPp, 'Прирост выручки (%)': resDOv100.revGainPct },
      { 'Фактор': 'д) Сбег: 5–7 мм/м', 'Baseline (%)': resDT5_7.bYield, 'Adaptive (%)': resDT5_7.aYield, 'Дельта (п.п.)': resDT5_7.deltaPp, 'Прирост выручки (%)': resDT5_7.revGainPct },
      { 'Фактор': 'д) Сбег: 7–11 мм/м', 'Baseline (%)': resDT7_11.bYield, 'Adaptive (%)': resDT7_11.aYield, 'Дельта (п.п.)': resDT7_11.deltaPp, 'Прирост выручки (%)': resDT7_11.revGainPct },
      { 'Фактор': 'д) Сбег: 11–14 мм/м', 'Baseline (%)': resDT11_14.bYield, 'Adaptive (%)': resDT11_14.aYield, 'Дельта (п.п.)': resDT11_14.deltaPp, 'Прирост выручки (%)': resDT11_14.revGainPct },
      { 'Фактор': 'д) Сбег: ГОСТ 32594 ф. (11)', 'Baseline (%)': resDTGost.bYield, 'Adaptive (%)': resDTGost.aYield, 'Дельта (п.п.)': resDTGost.deltaPp, 'Прирост выручки (%)': resDTGost.revGainPct },
    ];

    console.table(sensitivityTable);
    console.log('================================================================================================\n');

    expect(sensitivityTable.length).toBe(17);
  }, 90000);

  it('7. TaperSide доски: проверка вписания всех 4 углов в начальном сечении (z = zStart)', () => {
    const count = 1000;
    const seed = 42;
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    const logs = generateBatch(count, seed, config.kerf, true, true);
    let totalTaperBoards = 0;
    let passedTaperBoards = 0;

    for (const log of logs) {
      const res = optimizeLog(log, config, 'volume');
      const taperBoards = res.boards.filter((b) => b.zone === 'taperSide');

      for (const b of taperBoards) {
        totalTaperBoards++;
        const { rx, ry } = getCrossSectionRadii(
          b.zStart,
          log.topDiameter,
          log.ovality,
          log.taper
        );
        const hw = b.sawWidth / 2;
        const hh = b.sawHeight / 2;
        const corners = [
          { x: b.x - hw, y: b.y - hh },
          { x: b.x - hw, y: b.y + hh },
          { x: b.x + hw, y: b.y - hh },
          { x: b.x + hw, y: b.y + hh },
        ];

        const rad = (res.rotationAngle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let allCornersInside = true;
        for (const c of corners) {
          const xr = c.x * cos - c.y * sin;
          const yr = c.x * sin + c.y * cos;
          const val = (xr * xr) / (rx * rx) + (yr * yr) / (ry * ry);
          if (val > 1.0 + 1e-7) {
            allCornersInside = false;
            break;
          }
        }

        if (allCornersInside) {
          passedTaperBoards++;
        }
      }
    }

    console.log('\n================================================================================================');
    console.log(`🌲 ВЕРИФИКАЦИЯ TAPERSIDE ДОСОК: ВПИСАНИЕ В СЕЧЕНИИ z = zStart (1 000 БРЁВЕН)`);
    console.log('================================================================================================');
    console.log(`Всего сформировано сбеговых досок: ${totalTaperBoards} шт.`);
    console.log(`Успешно прошли проверку 4 углов: ${passedTaperBoards} шт.`);
    console.log(`Процент соответствия геометрии: ${((passedTaperBoards / totalTaperBoards) * 100).toFixed(2)}%`);
    console.log('================================================================================================\n');

    expect(totalTaperBoards).toBeGreaterThan(0);
    expect(passedTaperBoards).toBe(totalTaperBoards);
  });

  it('8. Единицы сбега и средний сбег по группам диаметров (ГОСТ 32594 формула 11, S в см/м -> мм/м)', () => {
    const count = 1000;
    const seed = 42;
    const prng = createMulberry32(seed + 505);

    const logs = generateBatch(count, seed, 3.6, true, true).map((l) => {
      const dCm = l.topDiameter / 10;
      const sCmM = 2.889 + 0.0987 * dCm - 0.8664 * Math.sqrt(dCm);
      const sMmM = sCmM * 10;
      const noise = generateNormal(prng, 0, 2.0);
      const taper = Math.max(2.0, Math.round((sMmM + noise) * 10) / 10);
      return { ...l, taper };
    });

    const groups = [
      { name: 'Тонкомер (140–180 мм)', min: 140, max: 180, sumTaper: 0, count: 0 },
      { name: 'Средний пиловочник (180–240 мм)', min: 180, max: 240, sumTaper: 0, count: 0 },
      { name: 'Крупный пиловочник (240–300 мм)', min: 240, max: 300, sumTaper: 0, count: 0 },
      { name: 'Крупномер (300–420 мм)', min: 300, max: 420, sumTaper: 0, count: 0 },
    ];

    for (const log of logs) {
      for (const g of groups) {
        if (log.topDiameter >= g.min && log.topDiameter < g.max) {
          g.sumTaper += log.taper;
          g.count++;
          break;
        }
      }
    }

    console.log('\n================================================================================================');
    console.log(`🌲 ВЕРИФИКАЦИЯ ЕДИНИЦ СБЕГА: ГОСТ 32594 ФОРМУЛА (11) С ШУМОМ SIGMA = 2 мм/м`);
    console.log('================================================================================================');

    const taperTable = groups.map((g) => ({
      'Группа диаметров': g.name,
      'Количество брёвен': g.count,
      'Средний сбег (мм/м)': (g.count > 0 ? (g.sumTaper / g.count).toFixed(2) : '—') + ' мм/м',
      'Проверка масштаба (мм/м)': '5 < s < 20 мм/м',
      'Статус': g.count > 0 && g.sumTaper / g.count > 5 && g.sumTaper / g.count < 20 ? '✓ КОРРЕКТНО' : '✗ ОШИБКА МАСШТАБА',
    }));

    console.table(taperTable);
    console.log('================================================================================================\n');

    for (const g of groups) {
      if (g.count > 0) {
        const avg = g.sumTaper / g.count;
        expect(avg).toBeGreaterThan(5);
        expect(avg).toBeLessThan(20);
      }
    }
  });

  it('9. Сравнение Adaptive Full vs Adaptive Value на Пресете 3 (1 000 брёвен, seed = 42)', () => {
    applyPricePreset('premiumScenario'); // Пресет 3: премия +15% на 50x150 и 50x200
    const count = 1000;
    const seed = 42;
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    const logs = generateBatch(count, seed, config.kerf, true, true);

    let afNomVol = 0, afLogVol = 0, afRevenue = 0;
    let avNomVol = 0, avLogVol = 0, avRevenue = 0;

    for (const log of logs) {
      const resFull = optimizeLog(log, config, 'volume');
      afNomVol += resFull.balance.nomBoardsVolume;
      afLogVol += resFull.balance.logVolume;
      afRevenue += resFull.totalRevenue;

      const resVal = optimizeLog(log, config, 'value');
      avNomVol += resVal.balance.nomBoardsVolume;
      avLogVol += resVal.balance.logVolume;
      avRevenue += resVal.totalRevenue;
    }

    const afYield = (afNomVol / afLogVol) * 100;
    const avYield = (avNomVol / avLogVol) * 100;
    const deltaRev = avRevenue - afRevenue;
    const deltaRevPct = (deltaRev / afRevenue) * 100;

    console.log('\n========================================================================================================================');
    console.log('🌲 ПРЕСЕТ 3: СРАВНЕНИЕ ADAPTIVE FULL (VOLUME) VS ADAPTIVE VALUE (1 000 БРЁВЕН, SEED = 42)');
    console.log('Примечание: гипотетический сценарий (+15% на 50×150 и 50×200), не рыночные данные');
    console.log('========================================================================================================================');

    const compareP3Table = [
      {
        'Стратегия': 'Adaptive Full (максимум объёма)',
        'Выход (%)': `${afYield.toFixed(2)}%`,
        'Выручка (₽)': `${Math.round(afRevenue).toLocaleString('ru-RU')} ₽`,
        'Дельта выручки к Adaptive Full': 'База (0 ₽ / 0.00%)',
        'Сценарий': 'гипотетический сценарий, не рыночные данные',
      },
      {
        'Стратегия': 'Adaptive Value (экономический оптимум)',
        'Выход (%)': `${avYield.toFixed(2)}%`,
        'Выручка (₽)': `${Math.round(avRevenue).toLocaleString('ru-RU')} ₽`,
        'Дельта выручки к Adaptive Full': `+${Math.round(deltaRev).toLocaleString('ru-RU')} ₽ (+${deltaRevPct.toFixed(2)}%)`,
        'Сценарий': 'гипотетический сценарий, не рыночные данные',
      },
    ];

    console.table(compareP3Table);
    console.log('========================================================================================================================\n');

    resetGostSections();

    expect(avRevenue).toBeGreaterThanOrEqual(afRevenue);
  }, 30000);

  it('10. Строгое соблюдение флага active и инвалидация кеша Baseline/Adaptive', () => {
    resetGostSections();
    const config: OptimizationConfig = {
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
      rotationStepDeg: 15,
    };

    const logs = generateBatch(100, 42, config.kerf, true, true);

    for (const log of logs) {
      const baseRes = evaluateBaseline(log, config);
      const optVolRes = optimizeLog(log, config, 'volume');
      const optValRes = optimizeLog(log, config, 'value');
      const refRes = referenceOptimize(log, config, 'volume');

      for (const res of [baseRes, optVolRes, optValRes, refRes]) {
        for (const b of res.boards) {
          const thick = Math.min(b.nomWidth, b.nomHeight);
          const width = Math.max(b.nomWidth, b.nomHeight);
          const active = isSectionActive(thick, width, GOST_24454_SECTIONS);
          expect(active).toBe(true);
          expect(b.pricePerM3).toBeGreaterThan(0);
        }
      }
    }

    // Отключаем 50x200 и 25x100 и проверяем мгновенный пересчёт кеша Baseline и Adaptive
    updateGostSection(50, 200, { active: false });
    updateGostSection(25, 100, { active: false });

    const largeLog: LogInput = {
      topDiameter: 320,
      length: 6.0,
      taper: 10,
      ovality: 0.95,
      kerf: 3.6,
      useShrinkage: true,
      useTaperBoards: true,
    };

    const updatedBase = evaluateBaseline(largeLog, config);
    const updatedVol = optimizeLog(largeLog, config, 'volume');
    const updatedVal = optimizeLog(largeLog, config, 'value');

    for (const res of [updatedBase, updatedVol, updatedVal]) {
      for (const b of res.boards) {
        const thick = Math.min(b.nomWidth, b.nomHeight);
        const width = Math.max(b.nomWidth, b.nomHeight);
        expect(isSectionActive(thick, width, GOST_24454_SECTIONS)).toBe(true);
        expect(thick === 50 && width === 200).toBe(false);
        expect(thick === 25 && width === 100).toBe(false);
      }
    }

    resetGostSections();
  });
});
