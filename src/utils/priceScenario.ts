import { PricePresetKey } from '../engine/gostData';

export type ActiveScenarioKey = PricePresetKey | 'custom';

export interface ScenarioMeta {
  key: ActiveScenarioKey;
  title: string;
  shortTitle: string;
  isHypothetical: boolean;
  note: string;
  fullLabel: string;
}

export function getScenarioMeta(key: ActiveScenarioKey): ScenarioMeta {
  switch (key) {
    case 'standard':
      return {
        key,
        title: '1. Открытые прайсы 25.11.2026 («Северлесгруп»)',
        shortTitle: '1. Открытые прайсы 25.11.2026',
        isHypothetical: false,
        note: '',
        fullLabel: '1. Открытые прайсы 25.11.2026 («Северлесгруп»)',
      };
    case 'dryScenario':
      return {
        key,
        title: '2. Сухая доска (сценарий)',
        shortTitle: '2. Сухая доска (сценарий)',
        isHypothetical: true,
        note: 'гипотеза, не рыночные данные',
        fullLabel: '2. Сухая доска (сценарий) — гипотеза, не рыночные данные',
      };
    case 'premiumScenario':
      return {
        key,
        title: '3. Премия 50×150 и 50×200 (гипотетический сценарий)',
        shortTitle: '3. Премия 50×150 и 50×200',
        isHypothetical: true,
        note: 'гипотеза, не рыночные данные',
        fullLabel: '3. Премия 50×150 и 50×200 — гипотеза, не рыночные данные',
      };
    case 'custom':
      return {
        key,
        title: 'Пользовательские цены',
        shortTitle: 'Пользовательские цены',
        isHypothetical: true,
        note: 'гипотеза, не рыночные данные',
        fullLabel: 'Пользовательские цены — гипотеза, не рыночные данные',
      };
  }
}
