/**
 * TimberOptima - Эталонный оптимизатор раскроя (Ground Truth Reference)
 *
 * Полный перебор без эвристических отсечений для верификации точности быстрой оптимизации.
 * Используется в модульных тестах и бенчмарках контроля качества.
 */

import {
  Board,
  LogInput,
  OptimizationConfig,
  OptimizationMode,
  SawingResult,
} from './types';
import {
  GOST_24454_SECTIONS,
  BYPRODUCT_PRICES,
  getShrinkageAllowance,
  getSectionPrice,
  isSectionActive,
} from './gostData';
import {
  evaluateBaseline,
  computeResult,
  createBoard,
  calcBoardMarginalRev,
} from './sawingEngine';
import {
  isBoxInscribed,
  getCrossSectionRadii,
  doBoardsOverlap,
  calculateLogVolume,
} from './geometry';

const STD_WIDTHS = [200, 150, 125, 100];
const STD_THICKS = [50, 40, 32, 25, 22];
const CORE_THICKS = [50, 40, 32];
const CANTS = [100, 125, 150, 200];
const ANGLES = [0, 15, 30, 45, 60, 75, 90];

interface SidePair {
  thickness: number;
  width: number;
}

interface RefConfig {
  cantThickness: number;
  coreThickness: number;
  coreCount: number;
  p2Sides: SidePair[];
  p1Sides: SidePair[];
  rotationAngle: number;
  hasTaperBoards: boolean;
  score: number;
}

/**
 * Эталонный полный перебор без эвристических отсечений
 */
export function referenceOptimize(
  log: LogInput,
  config: OptimizationConfig,
  mode: OptimizationMode = 'volume'
): SawingResult {
  const baseline = evaluateBaseline(log, config);
  const baselineScore =
    mode === 'volume' ? baseline.balance.nomBoardsVolume : baseline.totalRevenue;

  const kerf = config.kerf;
  const useShrinkage = config.useShrinkage;
  const sections = config.sections ?? GOST_24454_SECTIONS;
  const chipsPrice = BYPRODUCT_PRICES.chipsPricePerM3;
  const sawdustPrice = BYPRODUCT_PRICES.sawdustPricePerM3;
  const emptyLogChipsRev = calculateLogVolume(log) * chipsPrice;

  const rx0 = log.topDiameter / 2;
  const ry0 = (log.topDiameter * log.ovality) / 2;

  const angles = log.ovality < 0.99 ? ANGLES : [0];

  let bestConfig: RefConfig | null = null;
  let bestScore = baselineScore;

  // 1. Полный перебор углов поворота
  for (let a = 0; a < angles.length; a++) {
    const rot = angles[a];
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 2. Полный перебор всех стандартных толщин бруса
    for (let c = 0; c < CANTS.length; c++) {
      const cantT = CANTS[c];
      const scCant = useShrinkage
        ? cantT + getShrinkageAllowance(cantT, 'width')
        : cantT;

      // 3. Полный перебор толщин центральных досок
      for (let ct = 0; ct < CORE_THICKS.length; ct++) {
        const coreThick = CORE_THICKS[ct];
        if (!isSectionActive(coreThick, cantT, sections)) continue;

        const scCoreH = useShrinkage
          ? coreThick + getShrinkageAllowance(coreThick, 'thickness')
          : coreThick;

        // 4. Полный перебор количества центральных досок
        for (let coreCount = 2; coreCount <= 4; coreCount++) {
          const totalCoreH = coreCount * scCoreH + (coreCount - 1) * kerf;

          // Строгая проверка вписывания центрального пакета
          if (!isBoxInscribed(0, 0, scCant, totalCoreH, rx0, ry0, cos, sin)) {
            continue;
          }

          const coreNomVol =
            coreCount * cantT * 1e-3 * (coreThick * 1e-3) * log.length;
          const corePrice = getSectionPrice(coreThick, cantT, sections);
          const coreMargRev =
            coreCount *
            calcBoardMarginalRev(
              coreThick,
              cantT,
              scCoreH,
              scCant,
              log.length,
              kerf,
              corePrice,
              chipsPrice,
              sawdustPrice
            );

          // 5. Полный рекурсивный перебор боковых досок 2-го прохода (над и под брусом)
          function searchP2(topY: number, curPairs: SidePair[]): { pairs: SidePair[]; vol: number; rev: number; score: number } {
            const curVol = curPairs.reduce(
              (acc, p) => acc + 2 * p.width * 1e-3 * (p.thickness * 1e-3) * log.length,
              0
            );
            const curRev = curPairs.reduce((acc, p) => {
              const sawH = useShrinkage
                ? p.thickness + getShrinkageAllowance(p.thickness, 'thickness')
                : p.thickness;
              const sawW = useShrinkage
                ? p.width + getShrinkageAllowance(p.width, 'width')
                : p.width;
              const price = getSectionPrice(p.thickness, p.width, sections);
              return (
                acc +
                2 *
                  calcBoardMarginalRev(
                    p.thickness,
                    p.width,
                    sawH,
                    sawW,
                    log.length,
                    kerf,
                    price,
                    chipsPrice,
                    sawdustPrice
                  )
              );
            }, 0);
            let best = {
              pairs: curPairs,
              vol: curVol,
              rev: curRev,
              score: mode === 'volume' ? curVol : curRev,
            };

            if (curPairs.length >= 3) return best;

            for (let st = 0; st < STD_THICKS.length; st++) {
              const sThick = STD_THICKS[st];
              const sawH = useShrinkage
                ? sThick + getShrinkageAllowance(sThick, 'thickness')
                : sThick;

              for (let sw = 0; sw < STD_WIDTHS.length; sw++) {
                const sWidth = STD_WIDTHS[sw];
                if (sWidth > cantT || !isSectionActive(sThick, sWidth, sections)) continue;
                const sawW = useShrinkage
                  ? sWidth + getShrinkageAllowance(sWidth, 'width')
                  : sWidth;

                const cyTop = topY + sawH / 2;
                const cyBot = -cyTop;

                if (
                  isBoxInscribed(0, cyTop, sawW, sawH, rx0, ry0, cos, sin) &&
                  isBoxInscribed(0, cyBot, sawW, sawH, rx0, ry0, cos, sin)
                ) {
                  const sub = searchP2(topY + sawH + kerf, curPairs.concat([{ thickness: sThick, width: sWidth }]));
                  if (sub.score > best.score) {
                    best = sub;
                  }
                }
              }
            }

            return best;
          }

          const p2Res = searchP2(totalCoreH / 2 + kerf, []);

          // 6. Полный рекурсивный перебор боковых досок 1-го прохода (слева и справа от бруса)
          function searchP1(rightX: number, curPairs: SidePair[]): { pairs: SidePair[]; vol: number; rev: number; score: number } {
            const curVol = curPairs.reduce(
              (acc, p) => acc + 2 * p.width * 1e-3 * (p.thickness * 1e-3) * log.length,
              0
            );
            const curRev = curPairs.reduce((acc, p) => {
              const sawH = useShrinkage
                ? p.thickness + getShrinkageAllowance(p.thickness, 'thickness')
                : p.thickness;
              const sawW = useShrinkage
                ? p.width + getShrinkageAllowance(p.width, 'width')
                : p.width;
              const price = getSectionPrice(p.thickness, p.width, sections);
              return (
                acc +
                2 *
                  calcBoardMarginalRev(
                    p.thickness,
                    p.width,
                    sawH,
                    sawW,
                    log.length,
                    kerf,
                    price,
                    chipsPrice,
                    sawdustPrice
                  )
              );
            }, 0);
            let best = {
              pairs: curPairs,
              vol: curVol,
              rev: curRev,
              score: mode === 'volume' ? curVol : curRev,
            };

            if (curPairs.length >= 3) return best;

            for (let st = 0; st < STD_THICKS.length; st++) {
              const sThick = STD_THICKS[st];
              const sawThick = useShrinkage
                ? sThick + getShrinkageAllowance(sThick, 'thickness')
                : sThick;

              for (let sw = 0; sw < STD_WIDTHS.length; sw++) {
                const sWidth = STD_WIDTHS[sw];
                if (!isSectionActive(sThick, sWidth, sections)) continue;
                const sawWidth = useShrinkage
                  ? sWidth + getShrinkageAllowance(sWidth, 'width')
                  : sWidth;

                const cxRight = rightX + sawThick / 2;
                const cxLeft = -cxRight;

                if (
                  isBoxInscribed(cxRight, 0, sawThick, sawWidth, rx0, ry0, cos, sin) &&
                  isBoxInscribed(cxLeft, 0, sawThick, sawWidth, rx0, ry0, cos, sin)
                ) {
                  const sub = searchP1(rightX + sawThick + kerf, curPairs.concat([{ thickness: sThick, width: sWidth }]));
                  if (sub.score > best.score) {
                    best = sub;
                  }
                }
              }
            }

            return best;
          }

          const p1Res = searchP1(scCant / 2 + kerf, []);

          let curNomVol = coreNomVol + p2Res.vol + p1Res.vol;
          let curMargRev = coreMargRev + p2Res.rev + p1Res.rev;

          // 7. Сбеговая зона (укороченные доски, строго если 25×100 активно)
          let hasTaper = false;
          if (
            config.useTaperBoards &&
            isSectionActive(25, 100, sections) &&
            log.length >= 5.0 &&
            log.taper > 0
          ) {
            const tLen = 3.0;
            const zStart = log.length - tLen;
            const { rx: rxZ, ry: ryZ } = getCrossSectionRadii(
              zStart,
              log.topDiameter,
              log.ovality,
              log.taper
            );
            const tbT = 25;
            const tbW = 100;
            const stbT = useShrinkage
              ? tbT + getShrinkageAllowance(tbT, 'thickness')
              : tbT;
            const stbW = useShrinkage
              ? tbW + getShrinkageAllowance(tbW, 'width')
              : tbW;

            // Смещение с учётом установленных боковых досок 1-го прохода
            let taperRightX = scCant / 2 + kerf;
            for (const p of p1Res.pairs) {
              const sThick = useShrinkage
                ? p.thickness + getShrinkageAllowance(p.thickness, 'thickness')
                : p.thickness;
              taperRightX += sThick + kerf;
            }

            if (
              isBoxInscribed(
                taperRightX + stbT / 2,
                0,
                stbT,
                stbW,
                rxZ,
                ryZ,
                cos,
                sin
              ) &&
              isBoxInscribed(
                -(taperRightX + stbT / 2),
                0,
                stbT,
                stbW,
                rxZ,
                ryZ,
                cos,
                sin
              )
            ) {
              hasTaper = true;
              const tVol = 2 * tbW * 1e-3 * (tbT * 1e-3) * tLen;
              curNomVol += tVol;
              curMargRev +=
                2 *
                calcBoardMarginalRev(
                  tbT,
                  tbW,
                  stbT,
                  stbW,
                  tLen,
                  kerf,
                  getSectionPrice(tbT, tbW, sections),
                  chipsPrice,
                  sawdustPrice
                );
            }
          }

          const totalScore = mode === 'volume' ? curNomVol : emptyLogChipsRev + curMargRev;

          if (totalScore > bestScore + 1e-6) {
            bestScore = totalScore;
            bestConfig = {
              cantThickness: cantT,
              coreThickness: coreThick,
              coreCount,
              p2Sides: p2Res.pairs,
              p1Sides: p1Res.pairs,
              rotationAngle: rot,
              hasTaperBoards: hasTaper,
              score: totalScore,
            };
          }
        }
      }
    }
  }

  // Конструируем итоговый результат
  if (bestConfig) {
    const boards: Board[] = [];
    const cantT = bestConfig.cantThickness;
    const coreH = useShrinkage
      ? bestConfig.coreThickness +
        getShrinkageAllowance(bestConfig.coreThickness, 'thickness')
      : bestConfig.coreThickness;
    const totalCoreHeight =
      bestConfig.coreCount * coreH + (bestConfig.coreCount - 1) * kerf;
    const startY = -totalCoreHeight / 2;

    for (let i = 0; i < bestConfig.coreCount; i++) {
      const bY = startY + i * (coreH + kerf) + coreH / 2;
      boards.push(
        createBoard(
          `ref-core-${i + 1}`,
          0,
          bY,
          cantT,
          bestConfig.coreThickness,
          log.length,
          0,
          'core',
          2,
          useShrinkage,
          sections
        )
      );
    }

    let topOffset = totalCoreHeight / 2 + kerf;
    let botOffset = -totalCoreHeight / 2 - kerf;
    for (let i = 0; i < bestConfig.p2Sides.length; i++) {
      const s = bestConfig.p2Sides[i];
      const sbH = useShrinkage
        ? s.thickness + getShrinkageAllowance(s.thickness, 'thickness')
        : s.thickness;
      boards.push(
        createBoard(
          `ref-p2-top-${i + 1}`,
          0,
          topOffset + sbH / 2,
          s.width,
          s.thickness,
          log.length,
          0,
          'side',
          2,
          useShrinkage,
          sections
        ),
        createBoard(
          `ref-p2-bot-${i + 1}`,
          0,
          botOffset - sbH / 2,
          s.width,
          s.thickness,
          log.length,
          0,
          'side',
          2,
          useShrinkage,
          sections
        )
      );
      topOffset += sbH + kerf;
      botOffset -= sbH + kerf;
    }

    const sawCant = useShrinkage
      ? cantT + getShrinkageAllowance(cantT, 'width')
      : cantT;
    let rightOffset = sawCant / 2 + kerf;
    let leftOffset = -sawCant / 2 - kerf;
    for (let i = 0; i < bestConfig.p1Sides.length; i++) {
      const s = bestConfig.p1Sides[i];
      const sbThick = useShrinkage
        ? s.thickness + getShrinkageAllowance(s.thickness, 'thickness')
        : s.thickness;
      boards.push(
        createBoard(
          `ref-p1-right-${i + 1}`,
          rightOffset + sbThick / 2,
          0,
          s.thickness,
          s.width,
          log.length,
          0,
          'side',
          1,
          useShrinkage,
          sections
        ),
        createBoard(
          `ref-p1-left-${i + 1}`,
          leftOffset - sbThick / 2,
          0,
          s.thickness,
          s.width,
          log.length,
          0,
          'side',
          1,
          useShrinkage,
          sections
        )
      );
      rightOffset += sbThick + kerf;
      leftOffset -= sbThick + kerf;
    }

    if (bestConfig.hasTaperBoards) {
      const tLen = 3.0;
      const zStart = log.length - tLen;
      const tbT = 25;
      const tbW = 100;
      const stbT = useShrinkage
        ? tbT + getShrinkageAllowance(tbT, 'thickness')
        : tbT;
      boards.push(
        createBoard(
          'ref-taper-right',
          rightOffset + stbT / 2,
          0,
          tbT,
          tbW,
          tLen,
          zStart,
          'taperSide',
          1,
          useShrinkage,
          sections
        ),
        createBoard(
          'ref-taper-left',
          leftOffset - stbT / 2,
          0,
          tbT,
          tbW,
          tLen,
          zStart,
          'taperSide',
          1,
          useShrinkage,
          sections
        )
      );
    }

    for (let a = 0; a < boards.length; a++) {
      for (let b = a + 1; b < boards.length; b++) {
        if (doBoardsOverlap(boards[a], boards[b], kerf)) {
          boards.splice(b, 1);
          b--;
        }
      }
    }

    const res = computeResult(
      `Reference T${cantT}-C${bestConfig.coreCount}x${bestConfig.coreThickness}-R${bestConfig.rotationAngle}`,
      cantT,
      bestConfig.rotationAngle,
      boards,
      log,
      kerf
    );

    if (mode === 'volume') {
      if (res.balance.nomBoardsVolume >= baseline.balance.nomBoardsVolume - 1e-6) {
        return res;
      }
    } else {
      if (res.totalRevenue >= baseline.totalRevenue - 1e-4) {
        return res;
      }
    }
  }

  return baseline;
}
