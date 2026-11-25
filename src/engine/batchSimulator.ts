/**
 * TimberOptima - Пакетный симулятор раскроя партий брёвен
 * Детерминированный генератор партий, последовательная декомпозиция (Ablation study) и агрегация метрик.
 */

import {
  AggregateStats,
  DiameterGroupStats,
  LogInput,
  OptimizationConfig,
  SawingResult,
  SimulationSummary,
} from './types';
import {
  evaluateBaseline,
  applyPatternToLog,
  optimizeLog,
} from './sawingEngine';
import { getOptimalCircleEntry } from './baselineTables';
import { isBoxInscribed } from './geometry';
import {
  GOST_24454_SECTIONS,
  getShrinkageAllowance,
  isSectionActive,
} from './gostData';

const STD_WIDTHS = [200, 150, 125, 100];

const ROT_ANGLES = [0, 15, 30, 45, 60, 75, 90];

/**
 * Детерминированный генератор псевдослучайных чисел Mulberry32
 */
export function createMulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Нормальное распределение через преобразование Бокса-Мюллера
 */
export function generateNormal(
  prng: () => number,
  mean: number,
  stdDev: number
): number {
  let u1 = prng();
  let u2 = prng();
  while (u1 <= 1e-15) u1 = prng();
  while (u2 <= 1e-15) u2 = prng();

  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Генерация партии брёвен с нормальным распределением диаметров
 * Диаметры: 140–420 мм (среднее 220 мм, сигма 35 мм)
 * Овальность: 0.90–1.0
 * Сбег: 7–11 мм/м
 * Длина: 4.0 / 5.0 / 6.0 м
 */
export function generateBatch(
  count: number,
  seed: number = 42,
  defaultKerf: number = 3.6,
  useShrinkage: boolean = true,
  useTaperBoards: boolean = true,
  mean: number = 220,
  stdDev: number = 35
): LogInput[] {
  const prng = createMulberry32(seed);
  const lengths = [4.0, 5.0, 6.0];
  const logs: LogInput[] = [];

  for (let i = 0; i < count; i++) {
    const rawDiam = Math.round(generateNormal(prng, mean, stdDev));
    const topDiameter = Math.min(420, Math.max(140, rawDiam));
    const ovality = Math.round((0.9 + prng() * 0.1) * 1000) / 1000;
    const taper = Math.round((7.0 + prng() * 4.0) * 10) / 10;
    const lenIdx = Math.floor(prng() * lengths.length);
    const length = lengths[lenIdx];

    logs.push({
      topDiameter,
      length,
      taper,
      ovality,
      kerf: defaultKerf,
      useShrinkage,
      useTaperBoards,
    });
  }

  return logs;
}

function createEmptyAggregate(): AggregateStats {
  return {
    logCount: 0,
    totalLogVolume: 0,
    totalNomLumberVolume: 0,
    totalRawLumberVolume: 0,
    totalSawdustVolume: 0,
    totalChipsVolume: 0,
    averageRecoveryRate: 0,
    totalRevenue: 0,
    lumberRevenue: 0,
    chipsRevenue: 0,
    sawdustRevenue: 0,
  };
}

function accumulateResult(agg: AggregateStats, res: SawingResult): void {
  agg.logCount += 1;
  agg.totalLogVolume += res.balance.logVolume;
  agg.totalNomLumberVolume += res.balance.nomBoardsVolume;
  agg.totalRawLumberVolume += res.balance.rawBoardsVolume;
  agg.totalSawdustVolume += res.balance.sawdustVolume;
  agg.totalChipsVolume += res.balance.chipsVolume;
  agg.totalRevenue += res.totalRevenue;
  agg.lumberRevenue += res.lumberRevenue;
  agg.chipsRevenue += res.chipsRevenue;
  agg.sawdustRevenue += res.sawdustRevenue;
}

function finalizeAggregate(agg: AggregateStats): void {
  if (agg.totalLogVolume > 0) {
    agg.averageRecoveryRate =
      (agg.totalNomLumberVolume / agg.totalLogVolume) * 100;
  }
}

function getDiameterGroupName(diameter: number): string {
  if (diameter < 180) return '140-180 мм (Тонкомер)';
  if (diameter < 240) return '180-240 мм (Средний 1)';
  if (diameter < 300) return '240-300 мм (Средний 2)';
  return '300+ мм (Крупный)';
}

export type ProgressCallback = (current: number, total: number) => void;

/**
 * Запуск пакетной симуляции с полной декомпозицией:
 * 1. Baseline: сильный статичный постав по чётным ступеням (без коротких досок, без поворота)
 * 2a. Step Diameter: только фактический вершинный диаметр вместо округления до чётной ступени (без поворота)
 * 2b. Step Rotation: плюс подбор угла поворота овала (шаг 15°)
 * 2c. Adaptive Geometry: плюс подбор бруса и досок непосредственно под реальное эллиптическое сечение (rx, ry)
 * 3. Adaptive Full: объёмная оптимизация с короткими досками из сбега
 * 4. Adaptive Value: стоимостная оптимизация с короткими досками
 */
export function runBatchSimulation(
  logs: LogInput[],
  config: OptimizationConfig,
  seed: number = 42,
  onProgress?: ProgressCallback
): SimulationSummary {
  const baselineAgg = createEmptyAggregate();
  const stepDiamAgg = createEmptyAggregate();
  const stepRotAgg = createEmptyAggregate();
  const adaptiveGeoAgg = createEmptyAggregate();
  const adaptiveVolAgg = createEmptyAggregate();
  const adaptiveValAgg = createEmptyAggregate();

  const groupData: Record<
    string,
    {
      count: number;
      baseLogVol: number;
      baseNomVol: number;
      baseRev: number;
      stepDiamNomVol: number;
      stepRotNomVol: number;
      adGeoNomVol: number;
      adVolNomVol: number;
      adValNomVol: number;
      adValRev: number;
    }
  > = {};

  const total = logs.length;
  const sections = config.sections ?? GOST_24454_SECTIONS;

  for (let i = 0; i < total; i++) {
    const log = logs[i];
    const grp = getDiameterGroupName(log.topDiameter);
    if (!groupData[grp]) {
      groupData[grp] = {
        count: 0,
        baseLogVol: 0,
        baseNomVol: 0,
        baseRev: 0,
        stepDiamNomVol: 0,
        stepRotNomVol: 0,
        adGeoNomVol: 0,
        adVolNomVol: 0,
        adValNomVol: 0,
        adValRev: 0,
      };
    }

    // 1. Baseline
    const baseRes = evaluateBaseline(log, config);
    accumulateResult(baselineAgg, baseRes);

    // 2a. Только фактический диаметр (круг реального диаметра, без поворота)
    const circleEntry = getOptimalCircleEntry(log.topDiameter, config);
    const stepDiamRes = applyPatternToLog(circleEntry, log, config, 0, 'ExactCircle');
    accumulateResult(stepDiamAgg, stepDiamRes);

    // 2b. Плюс угол поворота овала (круг реального диаметра, лучший угол поворота овала)
    let bestRotAngle = 0;
    let bestRotVol = stepDiamRes.balance.nomBoardsVolume;

    if (log.ovality < 0.99) {
      const rx0 = log.topDiameter / 2;
      const ry0 = (log.topDiameter * log.ovality) / 2;

      for (let a = 1; a < ROT_ANGLES.length; a++) {
        const rot = ROT_ANGLES[a];
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let vol = 0;
        const scCant =
          circleEntry.cantThickness +
          (config.useShrinkage
            ? getShrinkageAllowance(circleEntry.cantThickness, 'width')
            : 0);
        const core = circleEntry.pass2Boards.find((b) => b.zone === 'core');
        if (core) {
          const scCoreH =
            core.thickness +
            (config.useShrinkage
              ? getShrinkageAllowance(core.thickness, 'thickness')
              : 0);
          const totalCoreH =
            core.count * scCoreH + (core.count - 1) * config.kerf;

          if (isBoxInscribed(0, 0, scCant, totalCoreH, rx0, ry0, cos, sin)) {
            vol +=
              core.count *
              core.width *
              1e-3 *
              (core.thickness * 1e-3) *
              log.length;

            let topOffset = totalCoreH / 2 + config.kerf;
            for (const sb of circleEntry.pass2Boards.filter(
              (b) => b.zone === 'side'
            )) {
              const sbH =
                sb.thickness +
                (config.useShrinkage
                  ? getShrinkageAllowance(sb.thickness, 'thickness')
                  : 0);
              let placed = false;
              for (const testW of STD_WIDTHS) {
                if (
                  testW > sb.width ||
                  testW > circleEntry.cantThickness ||
                  !isSectionActive(sb.thickness, testW, sections)
                ) {
                  continue;
                }
                const sawW =
                  testW +
                  (config.useShrinkage
                    ? getShrinkageAllowance(testW, 'width')
                    : 0);
                const cyTop = topOffset + sbH / 2;
                if (
                  isBoxInscribed(0, cyTop, sawW, sbH, rx0, ry0, cos, sin) &&
                  isBoxInscribed(0, -cyTop, sawW, sbH, rx0, ry0, cos, sin)
                ) {
                  vol += 2 * testW * 1e-3 * (sb.thickness * 1e-3) * log.length;
                  topOffset += sbH + config.kerf;
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                break;
              }
            }

            let rightOffset = scCant / 2 + config.kerf;
            for (const sb of circleEntry.pass1SideBoards) {
              const sbThick =
                sb.thickness +
                (config.useShrinkage
                  ? getShrinkageAllowance(sb.thickness, 'thickness')
                  : 0);
              let placed = false;
              for (const testW of STD_WIDTHS) {
                if (
                  testW > sb.width ||
                  !isSectionActive(sb.thickness, testW, sections)
                ) {
                  continue;
                }
                const sawW =
                  testW +
                  (config.useShrinkage
                    ? getShrinkageAllowance(testW, 'width')
                    : 0);
                const cxRight = rightOffset + sbThick / 2;
                if (
                  isBoxInscribed(cxRight, 0, sbThick, sawW, rx0, ry0, cos, sin) &&
                  isBoxInscribed(-cxRight, 0, sbThick, sawW, rx0, ry0, cos, sin)
                ) {
                  vol += 2 * testW * 1e-3 * (sb.thickness * 1e-3) * log.length;
                  rightOffset += sbThick + config.kerf;
                  placed = true;
                  break;
                }
              }
              if (!placed) {
                break;
              }
            }
          }
        }

        if (vol > bestRotVol) {
          bestRotVol = vol;
          bestRotAngle = rot;
        }
      }
    }

    const bestRotRes =
      bestRotAngle === 0
        ? stepDiamRes
        : applyPatternToLog(circleEntry, log, config, bestRotAngle, 'ExactCircle');
    accumulateResult(stepRotAgg, bestRotRes);

    // 2c. Adaptive Geometry: подбор бруса и досок под эллипс (без коротких досок)
    const adGeoRes = optimizeLog(
      log,
      { ...config, useTaperBoards: false },
      'volume'
    );
    accumulateResult(adaptiveGeoAgg, adGeoRes);

    // 3. Adaptive Full: с короткими досками из сбеговой зоны
    const adVolRes = optimizeLog(
      log,
      { ...config, useTaperBoards: true },
      'volume'
    );
    accumulateResult(adaptiveVolAgg, adVolRes);

    // 4. Adaptive Value: стоимостная оптимизация
    const adValRes = optimizeLog(
      log,
      { ...config, useTaperBoards: true },
      'value'
    );
    accumulateResult(adaptiveValAgg, adValRes);

    // Накопление по группам
    const g = groupData[grp];
    g.count += 1;
    g.baseLogVol += baseRes.balance.logVolume;
    g.baseNomVol += baseRes.balance.nomBoardsVolume;
    g.baseRev += baseRes.totalRevenue;

    g.stepDiamNomVol += stepDiamRes.balance.nomBoardsVolume;
    g.stepRotNomVol += bestRotRes.balance.nomBoardsVolume;
    g.adGeoNomVol += adGeoRes.balance.nomBoardsVolume;
    g.adVolNomVol += adVolRes.balance.nomBoardsVolume;
    g.adValNomVol += adValRes.balance.nomBoardsVolume;
    g.adValRev += adValRes.totalRevenue;

    if (onProgress && (i % 50 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }
  }

  finalizeAggregate(baselineAgg);
  finalizeAggregate(stepDiamAgg);
  finalizeAggregate(stepRotAgg);
  finalizeAggregate(adaptiveGeoAgg);
  finalizeAggregate(adaptiveVolAgg);
  finalizeAggregate(adaptiveValAgg);

  const diameterGroups: DiameterGroupStats[] = Object.keys(groupData)
    .sort()
    .map((grp) => {
      const g = groupData[grp];
      const logV = g.baseLogVol;
      return {
        groupName: grp,
        count: g.count,
        baselineRecoveryRate: logV > 0 ? (g.baseNomVol / logV) * 100 : 0,
        stepDiameterRecoveryRate: logV > 0 ? (g.stepDiamNomVol / logV) * 100 : 0,
        stepRotationRecoveryRate: logV > 0 ? (g.stepRotNomVol / logV) * 100 : 0,
        adaptiveGeometryRecoveryRate: logV > 0 ? (g.adGeoNomVol / logV) * 100 : 0,
        adaptiveVolumeRecoveryRate: logV > 0 ? (g.adVolNomVol / logV) * 100 : 0,
        adaptiveValueRecoveryRate: logV > 0 ? (g.adValNomVol / logV) * 100 : 0,
        baselineRevenue: g.baseRev,
        adaptiveValueRevenue: g.adValRev,
      };
    });

  const deltaDiameterPercent =
    stepDiamAgg.averageRecoveryRate - baselineAgg.averageRecoveryRate;
  const deltaRotationPercent =
    stepRotAgg.averageRecoveryRate - baselineAgg.averageRecoveryRate;
  const deltaGeometryPercent =
    adaptiveGeoAgg.averageRecoveryRate - baselineAgg.averageRecoveryRate;
  const deltaVolumePercent =
    adaptiveVolAgg.averageRecoveryRate - baselineAgg.averageRecoveryRate;
  const deltaValueRub = adaptiveValAgg.totalRevenue - baselineAgg.totalRevenue;
  const deltaValuePercent =
    baselineAgg.totalRevenue > 0
      ? (deltaValueRub / baselineAgg.totalRevenue) * 100
      : 0;

  return {
    totalLogs: total,
    seed,
    baseline: baselineAgg,
    stepDiameter: stepDiamAgg,
    stepRotation: stepRotAgg,
    adaptiveGeometry: adaptiveGeoAgg,
    adaptiveVolume: adaptiveVolAgg,
    adaptiveValue: adaptiveValAgg,
    deltaDiameterPercent,
    deltaRotationPercent,
    deltaGeometryPercent,
    deltaVolumePercent,
    deltaValueRub,
    deltaValuePercent,
    diameterGroups,
  };
}
