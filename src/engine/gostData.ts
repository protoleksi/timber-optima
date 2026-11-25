/**
 * TimberOptima - Справочные данные и нормативы
 * Данные ГОСТ сверены (ГОСТ 24454-80, ГОСТ 6782.1-75, ГОСТ 9463-2025).
 * Цены: открытые прайс-листы «Северлесгруп» от 25.11.2026 (сосна/ель, 1 сорт ГОСТ 8486-86, 6 м).
 */

import { BoardSection } from './types';

export const isGostDataVerified = true;
export const isVerified = true;

const SEVERLES_PRICE_URL =
  'https://severlesgroup.ru/pilomaterialy/doska-obreznaya/1-sort/f/material-is-sosna-el/sort-is-1-sort-gost/';

/**
 * Спецификация пиломатериалов по ГОСТ 24454-80 (хвойные породы).
 * Размеры приведены в миллиметрах (толщина × ширина).
 * 7 активных позиций по прайс-листу «Северлесгруп» от 25.11.2026.
 * 6 неактивных позиций (цена 0, не закупаются / вне прайса).
 */
export const GOST_24454_SECTIONS: BoardSection[] = [
  {
    thickness: 50,
    width: 200,
    active: true,
    pricePerM3: 17000,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 50,
    width: 150,
    active: true,
    pricePerM3: 17500,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 50,
    width: 125,
    active: false,
    pricePerM3: 0,
    priceSource: '',
    priceDate: '',
    priceUrl: '',
    isVerified: false,
  },
  {
    thickness: 50,
    width: 100,
    active: true,
    pricePerM3: 17500,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 40,
    width: 150,
    active: true,
    pricePerM3: 17500,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 40,
    width: 125,
    active: false,
    pricePerM3: 0,
    priceSource: '',
    priceDate: '',
    priceUrl: '',
    isVerified: false,
  },
  {
    thickness: 40,
    width: 100,
    active: true,
    pricePerM3: 17500,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 32,
    width: 150,
    active: false,
    pricePerM3: 0,
    priceSource: '',
    priceDate: '',
    priceUrl: '',
    isVerified: false,
  },
  {
    thickness: 32,
    width: 125,
    active: false,
    pricePerM3: 0,
    priceSource: '',
    priceDate: '',
    priceUrl: '',
    isVerified: false,
  },
  {
    thickness: 25,
    width: 150,
    active: true,
    pricePerM3: 17500,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 25,
    width: 125,
    active: false,
    pricePerM3: 0,
    priceSource: '',
    priceDate: '',
    priceUrl: '',
    isVerified: false,
  },
  {
    thickness: 25,
    width: 100,
    active: true,
    pricePerM3: 17500,
    priceSource: 'Северлесгруп, 25.11.2026',
    priceDate: '2026-11-25',
    priceUrl: SEVERLES_PRICE_URL,
    isVerified: true,
  },
  {
    thickness: 22,
    width: 100,
    active: false,
    pricePerM3: 0,
    priceSource: '',
    priceDate: '',
    priceUrl: '',
    isVerified: false,
  },
];

/**
 * Получить только активные сечения из спецификации
 */
export function getActiveSections(
  sections: BoardSection[] = GOST_24454_SECTIONS
): BoardSection[] {
  return sections.filter((s) => s.active);
}

/**
 * Проверить, активно ли конкретное сечение (толщина × ширина)
 */
export function isSectionActive(
  thickness: number,
  width: number,
  sections: BoardSection[] = GOST_24454_SECTIONS
): boolean {
  return sections.some(
    (s) => s.active && s.thickness === thickness && s.width === width
  );
}

/**
 * Построить детерминированный строковый ключ по составу активных сечений для кэширования
 */
export function getActiveSectionsKey(
  sections: BoardSection[] = GOST_24454_SECTIONS
): string {
  return sections
    .filter((s) => s.active)
    .map((s) => `${s.thickness}x${s.width}`)
    .sort()
    .join(',');
}

/**
 * Получить цену за м3 для конкретного сечения.
 * Возвращает цену сечения из спецификации (0 для неактивных/отсутствующих).
 */
export function getSectionPrice(
  thickness: number,
  width: number,
  sections: BoardSection[] = GOST_24454_SECTIONS
): number {
  const match = sections.find(
    (s) => s.thickness === thickness && s.width === width
  );
  return match && match.active ? match.pricePerM3 : 0;
}

/**
 * Припуски на усушку пиломатериалов по ГОСТ 6782.1-75, Таблица 5.
 * Пилопродукция из древесины хвойных пород (сосна, ель).
 * Номинал при влажности 20%, влажность при распиловке 38% и выше.
 */
export const SHRINKAGE_THICKNESS_MAP: Record<number, number> = {
  22: 0.7,
  25: 0.8,
  32: 1.0,
  40: 1.3,
  50: 1.6,
};

export const SHRINKAGE_WIDTH_MAP: Record<number, number> = {
  100: 2.9,
  125: 3.6,
  150: 4.1,
  200: 5.2,
};

/**
 * Получить припуск на усушку для размера
 */
export function getShrinkageAllowance(
  dimension: number,
  type: 'thickness' | 'width'
): number {
  const map = type === 'thickness' ? SHRINKAGE_THICKNESS_MAP : SHRINKAGE_WIDTH_MAP;
  if (dimension in map) {
    return map[dimension];
  }
  return Math.round(dimension * 0.026 * 10) / 10;
}

/**
 * Цены на вторичную продукцию (технологическая щепа и опилки)
 */
export const BYPRODUCT_PRICES = {
  chipsPricePerM3: 1800,
  sawdustPricePerM3: 450,
};

const BASE_PRICE_MAP: Record<
  string,
  { price: number; active: boolean; source: string; date: string; url: string }
> = {
  '50x200': { price: 17000, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '50x150': { price: 17500, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '50x125': { price: 0, active: false, source: '', date: '', url: '' },
  '50x100': { price: 17500, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '40x150': { price: 17500, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '40x125': { price: 0, active: false, source: '', date: '', url: '' },
  '40x100': { price: 17500, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '32x150': { price: 0, active: false, source: '', date: '', url: '' },
  '32x125': { price: 0, active: false, source: '', date: '', url: '' },
  '25x150': { price: 17500, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '25x125': { price: 0, active: false, source: '', date: '', url: '' },
  '25x100': { price: 17500, active: true, source: 'Северлесгруп, 25.11.2026', date: '2026-11-25', url: SEVERLES_PRICE_URL },
  '22x100': { price: 0, active: false, source: '', date: '', url: '' },
};

/**
 * Обновление параметров сечения в рантайме
 */
export function updateGostSection(
  thickness: number,
  width: number,
  updates: Partial<BoardSection>
): void {
  const match = GOST_24454_SECTIONS.find(
    (s) => s.thickness === thickness && s.width === width
  );
  if (match) {
    Object.assign(match, updates);
  }
}

/**
 * Обновление цены вторичной продукции
 */
export function updateByproductPrice(type: 'chips' | 'sawdust', price: number): void {
  if (type === 'chips') {
    BYPRODUCT_PRICES.chipsPricePerM3 = price;
  } else {
    BYPRODUCT_PRICES.sawdustPricePerM3 = price;
  }
}

/**
 * Сброс цен к базовым значениям (Пресет 1: Открытые прайсы 25.11.2026)
 */
export function resetGostSections(): void {
  for (const s of GOST_24454_SECTIONS) {
    const key = `${s.thickness}x${s.width}`;
    const base = BASE_PRICE_MAP[key];
    if (base) {
      s.pricePerM3 = base.price;
      s.active = base.active;
      s.priceSource = base.source;
      s.priceDate = base.date;
      s.priceUrl = base.url;
      s.isVerified = base.active;
    }
  }
  BYPRODUCT_PRICES.chipsPricePerM3 = 1800;
  BYPRODUCT_PRICES.sawdustPricePerM3 = 450;
}

export type PricePresetKey = 'standard' | 'dryScenario' | 'premiumScenario';

/**
 * Применение пресетов рыночных сценариев:
 * 1. standard (Пресет 1) — Открытые прайсы 25.11.2026 («Северлесгруп»)
 * 2. dryScenario (Пресет 2) — «Сухая доска (сценарий)»: цены Пресета 1 × 1.14 (гипотеза, не прайс)
 * 3. premiumScenario (Пресет 3) — «Премия 50×150 и 50×200 (гипотетический сценарий)»: +15% к Пресету 1 (гипотетический сценарий, не рыночные данные)
 */
export function applyPricePreset(preset: PricePresetKey): void {
  resetGostSections();
  if (preset === 'dryScenario') {
    // Пресет 2: Сухая доска (сценарий), цены Пресета 1 × 1.14 (гипотеза, не прайс)
    for (const s of GOST_24454_SECTIONS) {
      s.priceUrl = '';
      if (s.active) {
        s.pricePerM3 = Math.round(s.pricePerM3 * 1.14);
        s.priceSource = 'Сценарий «Сухая доска» (гипотеза, не прайс)';
      }
    }
  } else if (preset === 'premiumScenario') {
    // Пресет 3: Премия 50×150 и 50×200 (гипотетический сценарий), +15% к Пресету 1
    for (const s of GOST_24454_SECTIONS) {
      s.priceUrl = '';
    }
    const s50_200 = GOST_24454_SECTIONS.find((s) => s.thickness === 50 && s.width === 200);
    if (s50_200) {
      s50_200.pricePerM3 = Math.round(17000 * 1.15); // 19 550
      s50_200.priceSource = 'Гипотетический сценарий (+15%), не рыночные данные';
    }
    const s50_150 = GOST_24454_SECTIONS.find((s) => s.thickness === 50 && s.width === 150);
    if (s50_150) {
      s50_150.pricePerM3 = Math.round(17500 * 1.15); // 20 125
      s50_150.priceSource = 'Гипотетический сценарий (+15%), не рыночные данные';
    }
  }
}
