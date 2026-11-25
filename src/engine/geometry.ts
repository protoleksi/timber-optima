/**
 * TimberOptima - Модуль геометрических расчётов бревна и досок
 *
 * ЯВНОЕ ДОПУЩЕНИЕ МОДЕЛИ:
 * Моделируются строго обрезные пиломатериалы без обзола.
 * Все 4 угла пильного сечения (sawWidth × sawHeight) каждой доски
 * строго находятся внутри эллипса сечения бревна на своей стартовой координате z:
 * (x/rx)^2 + (y/ry)^2 <= 1.0.
 */

import { Board, LogInput } from './types';

/**
 * Полуоси сечения бревна на расстоянии z от вершинного торца (в миллиметрах).
 * z: расстояние от вершины (м)
 * topDiameter: диаметр в вершине (мм)
 * ovality: отношение малой полуоси к большой (0.85 - 1.0)
 * taper: сбежистость (мм/м)
 */
export function getCrossSectionRadii(
  z: number,
  topDiameter: number,
  ovality: number,
  taper: number
): { rx: number; ry: number } {
  const growth = (taper * z) / 2;
  const rx = topDiameter / 2 + growth;
  const ry = (topDiameter * ovality) / 2 + growth;
  return { rx, ry };
}

/**
 * Проверка вписывания точки (x, y) в эллипс с полуосями rx, ry при повороте бревна на угол rotationAngle (в градусах).
 * Инвариант: (x_rot / rx)^2 + (y_rot / ry)^2 <= 1.0
 */
export function isPointInsideEllipse(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotationAngleDeg: number = 0
): boolean {
  let xr = x;
  let yr = y;

  if (rotationAngleDeg !== 0) {
    const rad = (rotationAngleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    xr = x * cos - y * sin;
    yr = x * sin + y * cos;
  }

  const val = (xr * xr) / (rx * rx) + (yr * yr) / (ry * ry);
  return val <= 1.0 + 1e-9;
}

/**
 * Быстрая проверка вписывания прямоугольника с центром (cx, cy) и размерами (w, h)
 * в эллипс с полуосями rx, ry при предвычисленных cos, sin угла поворота.
 * Без создания промежуточных объектов в горячем цикле.
 */
export function isBoxInscribed(
  cx: number,
  cy: number,
  w: number,
  h: number,
  rx: number,
  ry: number,
  cos: number = 1,
  sin: number = 0
): boolean {
  const hw = w / 2;
  const hh = h / 2;

  // 4 угла:
  const x1 = cx - hw, y1 = cy - hh;
  const x2 = cx - hw, y2 = cy + hh;
  const x3 = cx + hw, y3 = cy - hh;
  const x4 = cx + hw, y4 = cy + hh;

  const rx2 = rx * rx;
  const ry2 = ry * ry;

  // Corner 1
  let xr = x1 * cos - y1 * sin;
  let yr = x1 * sin + y1 * cos;
  if ((xr * xr) / rx2 + (yr * yr) / ry2 > 1.0 + 1e-9) return false;

  // Corner 2
  xr = x2 * cos - y2 * sin;
  yr = x2 * sin + y2 * cos;
  if ((xr * xr) / rx2 + (yr * yr) / ry2 > 1.0 + 1e-9) return false;

  // Corner 3
  xr = x3 * cos - y3 * sin;
  yr = x3 * sin + y3 * cos;
  if ((xr * xr) / rx2 + (yr * yr) / ry2 > 1.0 + 1e-9) return false;

  // Corner 4
  xr = x4 * cos - y4 * sin;
  yr = x4 * sin + y4 * cos;
  if ((xr * xr) / rx2 + (yr * yr) / ry2 > 1.0 + 1e-9) return false;

  return true;
}

/**
 * Проверка вписывания всех 4 углов доски в сечение бревна на её стартовой координате zStart.
 */
export function isBoardInscribed(
  board: Board,
  log: LogInput,
  rotationAngleDeg: number = 0
): boolean {
  const { rx, ry } = getCrossSectionRadii(
    board.zStart,
    log.topDiameter,
    log.ovality,
    log.taper
  );

  const rad = (rotationAngleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return isBoxInscribed(
    board.x,
    board.y,
    board.sawWidth,
    board.sawHeight,
    rx,
    ry,
    cos,
    sin
  );
}

/**
 * Точный расчёт объёма бревна (в м³) как усечённого эллиптического конуса.
 * V = integral_0^L pi * rx(z) * ry(z) dz
 */
export function calculateLogVolume(log: LogInput): number {
  const L = log.length;
  const rx0 = log.topDiameter / 2;
  const ry0 = (log.topDiameter * log.ovality) / 2;
  const k = log.taper / 2;

  const integral =
    rx0 * ry0 * L +
    0.5 * k * (rx0 + ry0) * L * L +
    (1 / 3) * k * k * L * L * L;

  return Math.PI * 1e-6 * integral;
}

/**
 * Проверка взаимного непересечения двух досок в 3D пространстве с учётом kerf.
 */
export function doBoardsOverlap(a: Board, b: Board, kerf: number): boolean {
  const zStartA = a.zStart;
  const zEndA = a.zStart + a.length;
  const zStartB = b.zStart;
  const zEndB = b.zStart + b.length;

  const zOverlap = zStartA < zEndB - 1e-6 && zEndA > zStartB + 1e-6;
  if (!zOverlap) {
    return false;
  }

  const aMinX = a.x - a.sawWidth / 2;
  const aMaxX = a.x + a.sawWidth / 2;
  const aMinY = a.y - a.sawHeight / 2;
  const aMaxY = a.y + a.sawHeight / 2;

  const bMinX = b.x - b.sawWidth / 2;
  const bMaxX = b.x + b.sawWidth / 2;
  const bMinY = b.y - b.sawHeight / 2;
  const bMaxY = b.y + b.sawHeight / 2;

  const eps = 1e-4;
  const xOverlap = aMaxX > bMinX - kerf + eps && bMaxX > aMinX - kerf + eps;
  const yOverlap = aMaxY > bMinY - kerf + eps && bMaxY > aMinY - kerf + eps;

  return xOverlap && yOverlap;
}

/**
 * Расчёт объёма пропилов (опилок) для набора досок с учётом kerf.
 */
export function calculateSawdustVolume(boards: Board[], kerf: number): number {
  if (boards.length === 0) return 0;
  let totalSawdust = 0;

  for (const b of boards) {
    const cutArea = (b.sawWidth + b.sawHeight) * kerf;
    totalSawdust += cutArea * 1e-6 * b.length;
  }

  return totalSawdust;
}
