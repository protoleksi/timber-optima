/**
 * TimberOptima - Геометрическое расчётное ядро 2-проходного раскроя с брусовкой
 *
 * ЯВНОЕ ДОПУЩЕНИЕ МОДЕЛИ:
 * Моделируются строго обрезные пиломатериалы без обзола.
 * Все 4 угла пильного сечения (sawWidth × sawHeight) каждой доски
 * строго находятся внутри эллипса сечения бревна на своей стартовой координате z:
 * (x/rx)^2 + (y/ry)^2 <= 1.0.
 */

import {
  Board,
  BoardSection,
  LogInput,
  MaterialBalance,
  OptimizationConfig,
  OptimizationMode,
  SawingResult,
  BaselineEntry,
} from './types';
import {
  GOST_24454_SECTIONS,
  getSectionPrice,
  getShrinkageAllowance,
  isSectionActive,
  BYPRODUCT_PRICES,
} from './gostData';
import {
  getBaselineEntry,
  getOptimalCircleEntry,
} from './baselineTables';
import {
  calculateLogVolume,
  calculateSawdustVolume,
  isBoardInscribed,
  isBoxInscribed,
  doBoardsOverlap,
  getCrossSectionRadii,
} from './geometry';

const STD_WIDTHS = [200, 150, 125, 100];
const STD_THICKS = [50, 40, 32, 25, 22];
const CORE_THICKS = [50, 40, 32];
const CANTS = [100, 125, 150, 200];
const ROT_ANGLES = [0, 15, 30, 45, 60, 75, 90];

/**
 * Маржинальный вклад одной доски в полную выручку totalRevenue
 * (выручка от доски минус стоимость вытесненной щепы плюс чистый вклад опилок).
 */
export function calcBoardMarginalRev(
  nomThick: number,
  nomWidth: number,
  sawThick: number,
  sawWidth: number,
  length: number,
  kerf: number,
  boardPrice: number,
  chipsPrice: number,
  sawdustPrice: number
): number {
  const nomVol = nomThick * 1e-3 * (nomWidth * 1e-3) * length;
  const rawVol = sawThick * 1e-3 * (sawWidth * 1e-3) * length;
  const boardSawdust = (sawWidth + sawThick) * kerf * 1e-6 * length;
  return nomVol * boardPrice - rawVol * chipsPrice + boardSawdust * (sawdustPrice - chipsPrice);
}

function getMinSawThick(
  sections: BoardSection[],
  useShrinkage: boolean
): number {
  let minThick = Infinity;
  for (const s of sections) {
    if (!s.active) continue;
    const sawT = useShrinkage
      ? s.thickness + getShrinkageAllowance(s.thickness, 'thickness')
      : s.thickness;
    if (sawT < minThick) {
      minThick = sawT;
    }
  }
  return minThick;
}

/**
 * Создание доски с расчётом пильных размеров (с учётом усушки) и цен
 */
export function createBoard(
  id: string,
  x: number,
  y: number,
  nomWidth: number,
  nomHeight: number,
  length: number,
  zStart: number,
  zone: 'core' | 'side' | 'taperSide',
  pass: 1 | 2,
  useShrinkage: boolean,
  sections?: BoardSection[]
): Board {
  // Для вертикальных досок 1-го прохода (pass === 1) по оси X расположена толщина, по оси Y — ширина
  const isVertical = pass === 1;
  const thick = isVertical ? nomWidth : nomHeight;
  const width = isVertical ? nomHeight : nomWidth;

  const sawWidth = useShrinkage
    ? nomWidth + getShrinkageAllowance(nomWidth, isVertical ? 'thickness' : 'width')
    : nomWidth;
  const sawHeight = useShrinkage
    ? nomHeight + getShrinkageAllowance(nomHeight, isVertical ? 'width' : 'thickness')
    : nomHeight;

  const pricePerM3 = getSectionPrice(thick, width, sections);

  return {
    id,
    x,
    y,
    sawWidth,
    sawHeight,
    nomWidth,
    nomHeight,
    length,
    zStart,
    zone,
    pass,
    pricePerM3,
  };
}

/**
 * Расчёт материального баланса и выручки для заданного набора досок
 */
export function computeResult(
  patternName: string,
  cantThickness: number,
  rotationAngle: number,
  boards: Board[],
  log: LogInput,
  kerf: number
): SawingResult {
  const logVol = calculateLogVolume(log);

  let nomBoardsVol = 0;
  let rawBoardsVol = 0;
  let lumberRev = 0;

  for (const b of boards) {
    const nomVol = b.nomWidth * 1e-3 * (b.nomHeight * 1e-3) * b.length;
    const rawVol = b.sawWidth * 1e-3 * (b.sawHeight * 1e-3) * b.length;
    nomBoardsVol += nomVol;
    rawBoardsVol += rawVol;
    lumberRev += nomVol * b.pricePerM3;
  }

  const rawSawdust = calculateSawdustVolume(boards, kerf);
  const sawdustVol = Math.min(rawSawdust, Math.max(0, logVol - rawBoardsVol));
  const chipsVol = Math.max(0, logVol - rawBoardsVol - sawdustVol);
  const balanceError = Math.abs(logVol - (rawBoardsVol + sawdustVol + chipsVol));

  const balance: MaterialBalance = {
    logVolume: logVol,
    nomBoardsVolume: nomBoardsVol,
    rawBoardsVolume: rawBoardsVol,
    sawdustVolume: sawdustVol,
    chipsVolume: chipsVol,
    lumberRecoveryRate: logVol > 0 ? (nomBoardsVol / logVol) * 100 : 0,
    rawRecoveryRate: logVol > 0 ? (rawBoardsVol / logVol) * 100 : 0,
    balanceError,
  };

  const chipsRev = chipsVol * BYPRODUCT_PRICES.chipsPricePerM3;
  const sawdustRev = sawdustVol * BYPRODUCT_PRICES.sawdustPricePerM3;
  const totalRev = lumberRev + chipsRev + sawdustRev;

  return {
    patternName,
    cantThickness,
    rotationAngle,
    boards,
    balance,
    lumberRevenue: lumberRev,
    chipsRevenue: chipsRev,
    sawdustRevenue: sawdustRev,
    totalRevenue: totalRev,
  };
}

/**
 * Применение спецификации постава (BaselineEntry) к реальному бревну с заданным углом поворота.
 * Допускается только обрезка боковых досок до меньшей стандартной ширины (или отбрасывание) по овальности.
 */
export function applyPatternToLog(
  entry: BaselineEntry,
  log: LogInput,
  config: OptimizationConfig,
  rotationAngle: number = 0,
  patternPrefix: string = 'Baseline'
): SawingResult {
  const boards: Board[] = [];
  const kerf = config.kerf;
  const useShrinkage = config.useShrinkage;
  const sections = config.sections ?? GOST_24454_SECTIONS;

  const coreSpec = entry.pass2Boards.find((b) => b.zone === 'core');
  if (!coreSpec || !isSectionActive(coreSpec.thickness, coreSpec.width, sections)) {
    return computeResult(
      `${patternPrefix} D${entry.diameter}`,
      entry.cantThickness,
      rotationAngle,
      boards,
      log,
      kerf
    );
  }

  const cantT = entry.cantThickness;
  const coreH = useShrinkage
    ? coreSpec.thickness + getShrinkageAllowance(coreSpec.thickness, 'thickness')
    : coreSpec.thickness;

  const totalCoreHeight =
    coreSpec.count * coreH + (coreSpec.count - 1) * kerf;
  const startY = -totalCoreHeight / 2;

  // Центральные доски 2-го прохода
  let coreValid = true;
  for (let i = 0; i < coreSpec.count; i++) {
    const bY = startY + i * (coreH + kerf) + coreH / 2;
    const b = createBoard(
      `${patternPrefix}-core-${i + 1}`,
      0,
      bY,
      coreSpec.width,
      coreSpec.thickness,
      log.length,
      0,
      'core',
      2,
      useShrinkage,
      sections
    );
    if (!isBoardInscribed(b, log, rotationAngle)) {
      coreValid = false;
      break;
    }
    boards.push(b);
  }

  if (!coreValid) {
    return computeResult(
      `${patternPrefix} D${entry.diameter}`,
      cantT,
      rotationAngle,
      [],
      log,
      kerf
    );
  }

  // Боковые доски 2-го прохода (над и под брусом)
  let topOffset = totalCoreHeight / 2 + kerf;
  let botOffset = -totalCoreHeight / 2 - kerf;
  const p2SideSpecs = entry.pass2Boards.filter((b) => b.zone === 'side');

  for (let i = 0; i < p2SideSpecs.length; i++) {
    const spec = p2SideSpecs[i];
    const sbH = useShrinkage
      ? spec.thickness + getShrinkageAllowance(spec.thickness, 'thickness')
      : spec.thickness;

    let placedWidth = 0;
    for (const testW of STD_WIDTHS) {
      if (testW > spec.width || testW > cantT || !isSectionActive(spec.thickness, testW, sections)) {
        continue;
      }
      const topBoard = createBoard(
        `${patternPrefix}-p2-top-${i + 1}`,
        0,
        topOffset + sbH / 2,
        testW,
        spec.thickness,
        log.length,
        0,
        'side',
        2,
        useShrinkage,
        sections
      );
      const botBoard = createBoard(
        `${patternPrefix}-p2-bot-${i + 1}`,
        0,
        botOffset - sbH / 2,
        testW,
        spec.thickness,
        log.length,
        0,
        'side',
        2,
        useShrinkage,
        sections
      );

      if (
        isBoardInscribed(topBoard, log, rotationAngle) &&
        isBoardInscribed(botBoard, log, rotationAngle)
      ) {
        placedWidth = testW;
        boards.push(topBoard, botBoard);
        break;
      }
    }

    if (placedWidth > 0) {
      topOffset += sbH + kerf;
      botOffset -= sbH + kerf;
    } else {
      break;
    }
  }

  // Боковые доски 1-го прохода (слева и справа от бруса)
  const sawCant = useShrinkage
    ? cantT + getShrinkageAllowance(cantT, 'width')
    : cantT;
  let rightOffset = sawCant / 2 + kerf;
  let leftOffset = -sawCant / 2 - kerf;

  for (let i = 0; i < entry.pass1SideBoards.length; i++) {
    const spec = entry.pass1SideBoards[i];
    const sbThick = useShrinkage
      ? spec.thickness + getShrinkageAllowance(spec.thickness, 'thickness')
      : spec.thickness;

    let placedWidth = 0;
    for (const testW of STD_WIDTHS) {
      if (testW > spec.width || !isSectionActive(spec.thickness, testW, sections)) {
        continue;
      }
      const rightBoard = createBoard(
        `${patternPrefix}-p1-right-${i + 1}`,
        rightOffset + sbThick / 2,
        0,
        spec.thickness,
        testW,
        log.length,
        0,
        'side',
        1,
        useShrinkage,
        sections
      );
      const leftBoard = createBoard(
        `${patternPrefix}-p1-left-${i + 1}`,
        leftOffset - sbThick / 2,
        0,
        spec.thickness,
        testW,
        log.length,
        0,
        'side',
        1,
        useShrinkage,
        sections
      );

      if (
        isBoardInscribed(rightBoard, log, rotationAngle) &&
        isBoardInscribed(leftBoard, log, rotationAngle)
      ) {
        placedWidth = testW;
        boards.push(rightBoard, leftBoard);
        break;
      }
    }

    if (placedWidth > 0) {
      rightOffset += sbThick + kerf;
      leftOffset -= sbThick + kerf;
    } else {
      break;
    }
  }

  return computeResult(
    `${patternPrefix} D${entry.diameter}`,
    cantT,
    rotationAngle,
    boards,
    log,
    kerf
  );
}

/**
 * 1. Оценка базового типового постава (evaluateBaseline)
 * Применяет кешированный оптимум ближайшей меньшей чётной ступени по ГОСТ 9463-2025.
 */
export function evaluateBaseline(
  log: LogInput,
  config: OptimizationConfig
): SawingResult {
  const entry = getBaselineEntry(log.topDiameter, config);
  return applyPatternToLog(entry, log, config, 0, 'Baseline');
}

/**
 * Оценка постава под идеальный круг фактического диаметра бревна.
 * Используется в Ablation Study (шаги 2a и 2b).
 */
export function evaluateCirclePattern(
  log: LogInput,
  config: OptimizationConfig,
  rotationAngle: number = 0
): SawingResult {
  const exactCircleEntry = getOptimalCircleEntry(log.topDiameter, config);
  return applyPatternToLog(exactCircleEntry, log, config, rotationAngle, 'ExactCircle');
}

interface SidePair {
  thickness: number;
  width: number;
}

interface WinningConfig {
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
 * 2. Адаптивная оптимизация раскроя (optimizeLog)
 * Высокопроизводительный поиск с полным исследованием всех допустимых конфигураций
 * без потерь относительно эталона.
 */
export function optimizeLog(
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
  const minSawThick = getMinSawThick(sections, useShrinkage);

  const rx0 = log.topDiameter / 2;
  const ry0 = (log.topDiameter * log.ovality) / 2;

  // При абсолютно круглом бревне поворот не меняет сечение
  const angles = log.ovality < 0.99 ? ROT_ANGLES : [0];

  let bestConfig: WinningConfig | null = null;
  let bestScore = baselineScore;

  const maxRadius = Math.max(rx0, ry0);
  const maxDiameter = maxRadius * 2;
  const maxDiameterSq = maxDiameter * maxDiameter;

  for (let c = 0; c < CANTS.length; c++) {
    const cantT = CANTS[c];
    if (cantT >= maxDiameter) continue;
    const scCant = useShrinkage
      ? cantT + getShrinkageAllowance(cantT, 'width')
      : cantT;

    for (let ct = 0; ct < CORE_THICKS.length; ct++) {
      const coreThick = CORE_THICKS[ct];
      if (!isSectionActive(coreThick, cantT, sections)) continue;

      const scCoreH = useShrinkage
        ? coreThick + getShrinkageAllowance(coreThick, 'thickness')
        : coreThick;

      for (let coreCount = 2; coreCount <= 4; coreCount++) {
        const totalCoreH = coreCount * scCoreH + (coreCount - 1) * kerf;
        if (totalCoreH >= maxDiameter) continue;

        // Математический инвариант: если диагональ прямоугольника больше
        // большой оси эллипса, он гарантированно не влезет ни при каком угле поворота
        const diagSq = scCant * scCant + totalCoreH * totalCoreH;
        if (diagSq > maxDiameterSq + 1e-9) continue;

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

        for (let a = 0; a < angles.length; a++) {
          const rot = angles[a];
          const rad = (rot * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          if (!isBoxInscribed(0, 0, scCant, totalCoreH, rx0, ry0, cos, sin)) {
            continue;
          }

          // Рекурсивный поиск боковых досок 2-го прохода (над и под брусом)
          function searchP2(
            topY: number,
            depth: number,
            accVol: number,
            accRev: number,
            pairs: SidePair[]
          ): { pairs: SidePair[]; vol: number; rev: number; score: number } {
            const curScore = mode === 'volume' ? accVol : accRev;
            let best = { pairs, vol: accVol, rev: accRev, score: curScore };
            if (depth >= 3 || topY + minSawThick > maxRadius) return best;

            for (let st = 0; st < STD_THICKS.length; st++) {
              const sThick = STD_THICKS[st];
              const sawH = useShrinkage
                ? sThick + getShrinkageAllowance(sThick, 'thickness')
                : sThick;
              if (topY + sawH > maxRadius) continue;

              const cyTop = topY + sawH / 2;
              const cyBot = -cyTop;

              let bestW = 0;
              let bestPairRev = -Infinity;
              for (let sw = 0; sw < STD_WIDTHS.length; sw++) {
                const sWidth = STD_WIDTHS[sw];
                if (sWidth > cantT || !isSectionActive(sThick, sWidth, sections)) continue;
                const sawW = useShrinkage
                  ? sWidth + getShrinkageAllowance(sWidth, 'width')
                  : sWidth;
                if (sawW / 2 > maxRadius) continue;

                if (
                  isBoxInscribed(0, cyTop, sawW, sawH, rx0, ry0, cos, sin) &&
                  isBoxInscribed(0, cyBot, sawW, sawH, rx0, ry0, cos, sin)
                ) {
                  if (mode === 'volume') {
                    bestW = sWidth;
                    break; // В режиме объёма наибольшая ширина даёт наибольший объём
                  } else {
                    const price = getSectionPrice(sThick, sWidth, sections);
                    const pairRev =
                      2 *
                      calcBoardMarginalRev(
                        sThick,
                        sWidth,
                        sawH,
                        sawW,
                        log.length,
                        kerf,
                        price,
                        chipsPrice,
                        sawdustPrice
                      );
                    if (pairRev > bestPairRev) {
                      bestPairRev = pairRev;
                      bestW = sWidth;
                    }
                  }
                }
              }

              if (bestW > 0) {
                const addVol =
                  2 * bestW * 1e-3 * (sThick * 1e-3) * log.length;
                const addRev = mode === 'value' ? bestPairRev : 0;
                const nextPairs = pairs.concat([{ thickness: sThick, width: bestW }]);

                const sub = searchP2(
                  topY + sawH + kerf,
                  depth + 1,
                  accVol + addVol,
                  accRev + addRev,
                  nextPairs
                );
                if (sub.score > best.score) {
                  best = sub;
                }
              }
            }
            return best;
          }

          const p2Res = searchP2(totalCoreH / 2 + kerf, 0, 0, 0, []);

          // Рекурсивный поиск боковых досок 1-го прохода (слева и справа от бруса)
          function searchP1(
            rightX: number,
            depth: number,
            accVol: number,
            accRev: number,
            pairs: SidePair[]
          ): { pairs: SidePair[]; vol: number; rev: number; score: number } {
            const curScore = mode === 'volume' ? accVol : accRev;
            let best = { pairs, vol: accVol, rev: accRev, score: curScore };
            if (depth >= 3 || rightX + minSawThick > maxRadius) return best;

            for (let st = 0; st < STD_THICKS.length; st++) {
              const sThick = STD_THICKS[st];
              const sawThick = useShrinkage
                ? sThick + getShrinkageAllowance(sThick, 'thickness')
                : sThick;
              if (rightX + sawThick > maxRadius) continue;

              const cxRight = rightX + sawThick / 2;
              const cxLeft = -cxRight;

              let bestW = 0;
              let bestPairRev = -Infinity;
              for (let sw = 0; sw < STD_WIDTHS.length; sw++) {
                const sWidth = STD_WIDTHS[sw];
                if (!isSectionActive(sThick, sWidth, sections)) continue;
                const sawWidth = useShrinkage
                  ? sWidth + getShrinkageAllowance(sWidth, 'width')
                  : sWidth;
                if (sawWidth / 2 > maxRadius) continue;

                if (
                  isBoxInscribed(cxRight, 0, sawThick, sawWidth, rx0, ry0, cos, sin) &&
                  isBoxInscribed(cxLeft, 0, sawThick, sawWidth, rx0, ry0, cos, sin)
                ) {
                  if (mode === 'volume') {
                    bestW = sWidth;
                    break; // В режиме объёма наибольшая ширина даёт наибольший объём
                  } else {
                    const price = getSectionPrice(sThick, sWidth, sections);
                    const pairRev =
                      2 *
                      calcBoardMarginalRev(
                        sThick,
                        sWidth,
                        sawThick,
                        sawWidth,
                        log.length,
                        kerf,
                        price,
                        chipsPrice,
                        sawdustPrice
                      );
                    if (pairRev > bestPairRev) {
                      bestPairRev = pairRev;
                      bestW = sWidth;
                    }
                  }
                }
              }

              if (bestW > 0) {
                const addVol =
                  2 * bestW * 1e-3 * (sThick * 1e-3) * log.length;
                const addRev = mode === 'value' ? bestPairRev : 0;
                const nextPairs = pairs.concat([{ thickness: sThick, width: bestW }]);

                const sub = searchP1(
                  rightX + sawThick + kerf,
                  depth + 1,
                  accVol + addVol,
                  accRev + addRev,
                  nextPairs
                );
                if (sub.score > best.score) {
                  best = sub;
                }
              }
            }
            return best;
          }

          const p1Res = searchP1(scCant / 2 + kerf, 0, 0, 0, []);

          let curNomVol = coreNomVol + p2Res.vol + p1Res.vol;
          let curMargRev = coreMargRev + p2Res.rev + p1Res.rev;

          // Укороченные боковые доски в сбеговой зоне (строго если 25×100 активно)
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
          `opt-core-${i + 1}`,
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
          `opt-p2-top-${i + 1}`,
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
          `opt-p2-bot-${i + 1}`,
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
          `opt-p1-right-${i + 1}`,
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
          `opt-p1-left-${i + 1}`,
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
          'opt-taper-right',
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
          'opt-taper-left',
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
      `Adaptive T${cantT}-C${bestConfig.coreCount}x${bestConfig.coreThickness}-R${bestConfig.rotationAngle}`,
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
