/**
 * TimberOptima - Таблицы базовых типовых поставов (2-проходный раскрой с брусовкой)
 *
 * Поставы рассчитываются алгоритмически как оптимум по полезному объёму пиломатериалов
 * для идеально круглого бревна каждой ступени (ovality = 1, taper = 0) строго из активных сечений,
 * кешируются по ключу (диаметр, kerf, усушка, состав активных сечений) и применяются к реальным брёвнам.
 */

import { BaselineEntry, OptimizationConfig } from './types';
import {
  GOST_24454_SECTIONS,
  getActiveSectionsKey,
  getShrinkageAllowance,
  isSectionActive,
} from './gostData';
import { isBoxInscribed } from './geometry';

const STD_WIDTHS = [200, 150, 125, 100];
const STD_THICKS = [50, 40, 32, 25, 22];
const CORE_THICKS = [50, 40, 32];
const BASELINE_STEPS = [140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420];

/**
 * Построить детерминированный ключ кеша с учётом диаметра, параметров распила и активных сечений
 */
export function buildBaselineCacheKey(
  diameter: number,
  config?: Partial<OptimizationConfig>
): string {
  const kerf = config?.kerf ?? 3.6;
  const useShrinkage = config?.useShrinkage ?? true;
  const sections = config?.sections ?? GOST_24454_SECTIONS;
  const activeKey = getActiveSectionsKey(sections);
  return `${diameter}|k=${kerf}|s=${useShrinkage ? 1 : 0}|act=${activeKey}`;
}

/**
 * Алгоритмический расчёт оптимального 2-проходного постава с брусовкой
 * для идеального круглого бревна заданного диаметра D (ovality = 1, taper = 0)
 * строго из активных сечений спецификации.
 */
export function calculateOptimalBaseline(
  diameter: number,
  config?: Partial<OptimizationConfig>
): BaselineEntry {
  const kerf = config?.kerf ?? 3.6;
  const useShrinkage = config?.useShrinkage ?? true;
  const sections = config?.sections ?? GOST_24454_SECTIONS;
  const R = diameter / 2;

  let bestEntry: BaselineEntry = {
    diameter,
    cantThickness: 0,
    pass1SideBoards: [],
    pass2Boards: [],
    isVerified: false,
  };
  let maxNomArea = 0;

  for (const cant of STD_WIDTHS) {
    if (cant >= diameter) continue;
    const scCant = useShrinkage
      ? cant + getShrinkageAllowance(cant, 'width')
      : cant;

    for (const cT of CORE_THICKS) {
      if (!isSectionActive(cT, cant, sections)) continue;

      const scT = useShrinkage
        ? cT + getShrinkageAllowance(cT, 'thickness')
        : cT;

      for (let cCount = 2; cCount <= 4; cCount++) {
        const totalCoreH = cCount * scT + (cCount - 1) * kerf;
        if (!isBoxInscribed(0, 0, scCant, totalCoreH, R, R, 1, 0)) continue;

        const baseCoreArea = cCount * cant * cT;

        // Поиск боковых досок 2-го прохода (над и под брусом)
        function solveP2(
          topY: number,
          currentPairs: Array<{ thickness: number; width: number }>
        ): { pairs: Array<{ thickness: number; width: number }>; area: number } {
          let bestP2 = { pairs: currentPairs, area: 0 };
          if (currentPairs.length >= 3) return bestP2;

          for (const sT of STD_THICKS) {
            const ssT = useShrinkage
              ? sT + getShrinkageAllowance(sT, 'thickness')
              : sT;
            for (const sW of STD_WIDTHS) {
              if (sW > cant || !isSectionActive(sT, sW, sections)) continue;
              const ssW = useShrinkage
                ? sW + getShrinkageAllowance(sW, 'width')
                : sW;
              const cyTop = topY + ssT / 2;
              const cyBot = -cyTop;

              if (
                isBoxInscribed(0, cyTop, ssW, ssT, R, R, 1, 0) &&
                isBoxInscribed(0, cyBot, ssW, ssT, R, R, 1, 0)
              ) {
                const sub = solveP2(
                  topY + ssT + kerf,
                  currentPairs.concat([{ thickness: sT, width: sW }])
                );
                const totalA = 2 * sW * sT + sub.area;
                if (totalA > bestP2.area) {
                  bestP2 = { pairs: sub.pairs, area: totalA };
                }
              }
            }
          }
          return bestP2;
        }

        const p2Res = solveP2(totalCoreH / 2 + kerf, []);

        // Поиск боковых досок 1-го прохода (слева и справа от бруса)
        function solveP1(
          rightX: number,
          currentPairs: Array<{ thickness: number; width: number; count: number }>
        ): { pairs: Array<{ thickness: number; width: number; count: number }>; area: number } {
          let bestP1 = { pairs: currentPairs, area: 0 };
          if (currentPairs.length >= 3) return bestP1;

          for (const sT of STD_THICKS) {
            const ssT = useShrinkage
              ? sT + getShrinkageAllowance(sT, 'thickness')
              : sT;
            for (const sW of STD_WIDTHS) {
              if (!isSectionActive(sT, sW, sections)) continue;
              const ssW = useShrinkage
                ? sW + getShrinkageAllowance(sW, 'width')
                : sW;
              const cxRight = rightX + ssT / 2;
              const cxLeft = -cxRight;

              if (
                isBoxInscribed(cxRight, 0, ssT, ssW, R, R, 1, 0) &&
                isBoxInscribed(cxLeft, 0, ssT, ssW, R, R, 1, 0)
              ) {
                const sub = solveP1(
                  rightX + ssT + kerf,
                  currentPairs.concat([{ thickness: sT, width: sW, count: 1 }])
                );
                const totalA = 2 * sW * sT + sub.area;
                if (totalA > bestP1.area) {
                  bestP1 = { pairs: sub.pairs, area: totalA };
                }
              }
            }
          }
          return bestP1;
        }

        const p1Res = solveP1(scCant / 2 + kerf, []);

        const totalNomArea = baseCoreArea + p2Res.area + p1Res.area;
        if (totalNomArea > maxNomArea) {
          maxNomArea = totalNomArea;
          bestEntry = {
            diameter,
            cantThickness: cant,
            isVerified: false,
            pass1SideBoards: p1Res.pairs,
            pass2Boards: [
              {
                thickness: cT,
                width: cant,
                count: cCount,
                zone: 'core',
              },
              ...p2Res.pairs.map((p) => ({
                thickness: p.thickness,
                width: p.width,
                count: 2,
                zone: 'side' as const,
              })),
            ],
          };
        }
      }
    }
  }

  return bestEntry;
}

/**
 * Кеш алгоритмически предвычисленных базовых поставов.
 * Ключ включает ступень диаметра, kerf, усушку и состав активных сечений.
 */
const BASELINE_CACHE: Map<string, BaselineEntry> = new Map();

/**
 * Получить базовый типовой постав для заданного диаметра бревна.
 * Выбирается ближайший меньший чётный диаметр из таблицы (по ГОСТ 9463-2025).
 */
export function getBaselineEntry(
  topDiameter: number,
  config?: Partial<OptimizationConfig>
): BaselineEntry {
  const floorEven = Math.min(
    420,
    Math.max(140, Math.floor(topDiameter / 20) * 20)
  );
  const key = buildBaselineCacheKey(floorEven, config);
  let entry = BASELINE_CACHE.get(key);
  if (!entry) {
    entry = calculateOptimalBaseline(floorEven, config);
    BASELINE_CACHE.set(key, entry);
  }
  return entry;
}

export const BASELINE_SAWING_TABLE: BaselineEntry[] = BASELINE_STEPS.map(
  (d) => getBaselineEntry(d)
);

/**
 * Кеш оптимальных поставов для непрерывных целочисленных диаметров (шаг 1 мм)
 * с учётом состава активных сечений и параметров распила.
 */
const CONTINUOUS_CIRCLE_CACHE: Map<string, BaselineEntry> = new Map();

export function getOptimalCircleEntry(
  diameter: number,
  config?: Partial<OptimizationConfig>
): BaselineEntry {
  const d = Math.round(diameter);
  const key = buildBaselineCacheKey(d, config);
  let entry = CONTINUOUS_CIRCLE_CACHE.get(key);
  if (!entry) {
    entry = calculateOptimalBaseline(d, config);
    CONTINUOUS_CIRCLE_CACHE.set(key, entry);
  }
  return entry;
}

/**
 * Выход базы на идеально круглых брёвнах (ovality = 1, taper = 0)
 */
export function getCylinderBaselineYields(config?: Partial<OptimizationConfig>): Array<{
  diameter: number;
  cantThickness: number;
  coreSpec: string;
  p2Count: number;
  p1Count: number;
  cylinderYieldPct: number;
}> {
  return BASELINE_STEPS.map((D) => {
    const entry = getBaselineEntry(D, config);
    const R = D / 2;
    const cylArea = Math.PI * R * R;

    let nomArea = 0;
    const core = entry.pass2Boards.find((b) => b.zone === 'core');
    if (core) {
      nomArea += core.count * core.width * core.thickness;
    }

    for (const p of entry.pass2Boards.filter((b) => b.zone === 'side')) {
      nomArea += p.count * p.width * p.thickness;
    }

    for (const p of entry.pass1SideBoards) {
      nomArea += 2 * p.count * p.width * p.thickness;
    }

    return {
      diameter: D,
      cantThickness: entry.cantThickness,
      coreSpec: core ? `${core.count}x${core.thickness}x${core.width}` : '—',
      p2Count: entry.pass2Boards.filter((b) => b.zone === 'side').length,
      p1Count: entry.pass1SideBoards.length,
      cylinderYieldPct: (nomArea / cylArea) * 100,
    };
  });
}
