import React, { useState } from 'react';
import {
  GOST_24454_SECTIONS,
  BYPRODUCT_PRICES,
  PricePresetKey,
  updateGostSection,
  updateByproductPrice,
  applyPricePreset,
  resetGostSections,
  getShrinkageAllowance,
} from '../engine/gostData';
import { BoardSection } from '../engine/types';
import { RotateCcw, ShoppingBag, Layers, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface PricingPortfolioProps {
  onPricesUpdated: () => void;
}

export const PricingPortfolio: React.FC<PricingPortfolioProps> = ({
  onPricesUpdated,
}) => {
  const { isDark } = useTheme();
  const [sections, setSections] = useState<BoardSection[]>([...GOST_24454_SECTIONS]);
  const [chipsPrice, setChipsPrice] = useState<number>(BYPRODUCT_PRICES.chipsPricePerM3);
  const [sawdustPrice, setSawdustPrice] = useState<number>(BYPRODUCT_PRICES.sawdustPricePerM3);
  const [activePreset, setActivePreset] = useState<PricePresetKey>('standard');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handlePriceChange = (thickness: number, width: number, newPrice: number) => {
    updateGostSection(thickness, width, { pricePerM3: newPrice });
    setSections([...GOST_24454_SECTIONS]);
    onPricesUpdated();
  };

  const handleActiveToggle = (thickness: number, width: number, active: boolean) => {
    updateGostSection(thickness, width, { active });
    setSections([...GOST_24454_SECTIONS]);
    onPricesUpdated();
  };

  const handleSourceChange = (thickness: number, width: number, source: string) => {
    const isSourceEmpty = source.trim() === '';
    updateGostSection(thickness, width, {
      priceSource: source,
      priceDate: isSourceEmpty ? '' : (sections.find((s) => s.thickness === thickness && s.width === width)?.priceDate || ''),
    });
    setSections([...GOST_24454_SECTIONS]);
    onPricesUpdated();
  };

  const handleDateChange = (thickness: number, width: number, date: string) => {
    updateGostSection(thickness, width, { priceDate: date });
    setSections([...GOST_24454_SECTIONS]);
    onPricesUpdated();
  };

  const handleChipsChange = (price: number) => {
    setChipsPrice(price);
    updateByproductPrice('chips', price);
    onPricesUpdated();
  };

  const handleSawdustChange = (price: number) => {
    setSawdustPrice(price);
    updateByproductPrice('sawdust', price);
    onPricesUpdated();
  };

  const handleApplyPreset = (preset: PricePresetKey) => {
    applyPricePreset(preset);
    setActivePreset(preset);
    setSections([...GOST_24454_SECTIONS]);
    setChipsPrice(BYPRODUCT_PRICES.chipsPricePerM3);
    setSawdustPrice(BYPRODUCT_PRICES.sawdustPricePerM3);
    onPricesUpdated();

    const names = {
      standard: '«Открытые прайсы 25.11.2026 (Северлесгруп)»',
      dryScenario: '«Сухая доска (сценарий)»',
      premiumScenario: '«Премия 50×150 и 50×200 (гипотетический сценарий)»',
    };
    showToast(`Применён сценарий ${names[preset]}.`);
  };

  const handleReset = () => {
    resetGostSections();
    setActivePreset('standard');
    setSections([...GOST_24454_SECTIONS]);
    setChipsPrice(1800);
    setSawdustPrice(450);
    onPricesUpdated();
    showToast('Цены сброшены к базовым значениям по ГОСТ.');
  };

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
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${textHead}`}>
            Портфель заказов и рыночные цены
          </h1>
          <p className={`text-xs mt-0.5 ${textSub}`}>
            Прейскурант пиломатериалов и побочной продукции. Изменения мгновенно влияют на оптимизацию по выручке.
          </p>
        </div>

        <button
          onClick={handleReset}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition ${
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 opacity-60" />
          <span>Сбросить цены к базовым</span>
        </button>
      </div>

      {/* Market Presets: Clean Light / Dark Style */}
      <div className={`border rounded-lg p-4 shadow-none transition-colors ${cardCls}`}>
        <span className={`text-xs font-semibold uppercase tracking-wider block mb-3 ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
          Рыночные сценарии
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Preset 1 */}
          <button
            onClick={() => handleApplyPreset('standard')}
            className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between ${
              activePreset === 'standard'
                ? isDark
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                  : 'bg-emerald-50/50 border-emerald-600 ring-1 ring-emerald-600'
                : isDark
                ? 'bg-zinc-800/40 border-zinc-700/80 hover:bg-zinc-800'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                1. Открытые прайсы 25.11.2026
              </span>
              <span
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  activePreset === 'standard'
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-emerald-700 bg-emerald-700'
                    : isDark
                    ? 'border-zinc-600 bg-zinc-800'
                    : 'border-slate-400 bg-white'
                }`}
              >
                {activePreset === 'standard' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${textSub}`}>
              Базовые прайсы «Северлесгруп»: 50×200 = 17 000 ₽/м³, остальные 6 сечений = 17 500 ₽/м³.
            </p>
          </button>

          {/* Preset 2 */}
          <button
            onClick={() => handleApplyPreset('dryScenario')}
            className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between ${
              activePreset === 'dryScenario'
                ? isDark
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                  : 'bg-emerald-50/50 border-emerald-600 ring-1 ring-emerald-600'
                : isDark
                ? 'bg-zinc-800/40 border-zinc-700/80 hover:bg-zinc-800'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                2. Сухая доска (сценарий)
              </span>
              <span
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  activePreset === 'dryScenario'
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-emerald-700 bg-emerald-700'
                    : isDark
                    ? 'border-zinc-600 bg-zinc-800'
                    : 'border-slate-400 bg-white'
                }`}
              >
                {activePreset === 'dryScenario' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${textSub}`}>
              Цены Пресета 1 × 1.14 (19 380–19 950 ₽/м³). Моделирование надбавки за сушку. (гипотеза, не прайс)
            </p>
          </button>

          {/* Preset 3 */}
          <button
            onClick={() => handleApplyPreset('premiumScenario')}
            className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between ${
              activePreset === 'premiumScenario'
                ? isDark
                  ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                  : 'bg-emerald-50/50 border-emerald-600 ring-1 ring-emerald-600'
                : isDark
                ? 'bg-zinc-800/40 border-zinc-700/80 hover:bg-zinc-800'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                3. Премия 50×150 и 50×200 (гипотетический сценарий)
              </span>
              <span
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  activePreset === 'premiumScenario'
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-emerald-700 bg-emerald-700'
                    : isDark
                    ? 'border-zinc-600 bg-zinc-800'
                    : 'border-slate-400 bg-white'
                }`}
              >
                {activePreset === 'premiumScenario' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className={`text-[11px] mt-1.5 leading-relaxed ${textSub}`}>
              Надбавка +15% к Пресету 1 на 50×150 (20 125 ₽) и 50×200 (19 550 ₽). (гипотетический сценарий, не рыночные данные)
            </p>
          </button>
        </div>
      </div>

      {/* Main Grid: Full-Width Table + Secondary Byproducts */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Byproducts Sidebar Block (260px) */}
        <div className={`w-full lg:w-64 shrink-0 border rounded-lg p-4 shadow-none space-y-4 transition-colors ${cardCls}`}>
          <div className={`flex items-center gap-2 pb-2.5 border-b text-xs font-semibold ${isDark ? 'border-zinc-800 text-zinc-100' : 'border-slate-100 text-slate-800'}`}>
            <ShoppingBag className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
            <span>Вторичная продукция</span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className={`font-medium block mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Технологическая щепа:
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={50}
                  value={chipsPrice}
                  onChange={(e) => handleChipsChange(Number(e.target.value) || 0)}
                  className={`w-full px-2.5 py-1.5 font-semibold rounded border focus:outline-none tabular-nums ${inputCls}`}
                />
                <span className={`absolute right-2.5 top-1.5 ${textSub}`}>
                  ₽/м³
                </span>
              </div>
            </div>

            <div>
              <label className={`font-medium block mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Опилки пильные:
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={25}
                  value={sawdustPrice}
                  onChange={(e) => handleSawdustChange(Number(e.target.value) || 0)}
                  className={`w-full px-2.5 py-1.5 font-semibold rounded border focus:outline-none tabular-nums ${inputCls}`}
                />
                <span className={`absolute right-2.5 top-1.5 ${textSub}`}>
                  ₽/м³
                </span>
              </div>
            </div>
          </div>

          <div className={`pt-2 border-t text-[11px] leading-relaxed ${isDark ? 'border-zinc-800 text-zinc-500' : 'border-slate-100 text-slate-500'}`}>
            Побочные продукты учитываются в общем материальном балансе раскроя бревна (100%).
          </div>
        </div>

        {/* Full-Width Specification Table */}
        <div className={`flex-1 min-w-0 border rounded-lg overflow-hidden shadow-none transition-colors ${cardCls}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <Layers className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
              <span className={`font-semibold text-xs ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>
                Спецификация пиломатериалов ГОСТ 24454-80 (13 позиций)
              </span>
            </div>
            <span className={`text-[11px] ${textSub}`}>
              Хвойные породы (сосна/ель)
            </span>
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
                  <th className="py-2.5 px-3 text-center w-12">Вкл.</th>
                  <th className="py-2.5 px-3 w-28">Номинал (мм)</th>
                  <th className="py-2.5 px-3 w-36">Припуск усушки</th>
                  <th className="py-2.5 px-3 w-36">Пильный размер</th>
                  <th className="py-2.5 px-3 w-36">Цена (₽/м³)</th>
                  <th className="py-2.5 px-3">Источник прайса</th>
                  <th className="py-2.5 px-3 w-32">Дата</th>
                </tr>
              </thead>
              <tbody className={`divide-y tabular-nums ${isDark ? 'divide-zinc-800/60' : 'divide-slate-100'}`}>
                {sections.map((s) => {
                  const allowT = getShrinkageAllowance(s.thickness, 'thickness');
                  const allowW = getShrinkageAllowance(s.width, 'width');
                  const sawT = (s.thickness + allowT).toFixed(1);
                  const sawW = (s.width + allowW).toFixed(1);

                  return (
                    <tr
                      key={`${s.thickness}x${s.width}`}
                      className={`transition ${
                        !s.active
                          ? 'opacity-40'
                          : isDark
                          ? 'hover:bg-zinc-800/40'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={s.active}
                          onChange={(e) =>
                            handleActiveToggle(s.thickness, s.width, e.target.checked)
                          }
                          className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                        />
                      </td>

                      <td className={`py-2 px-3 font-bold whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                        {s.thickness} × {s.width}
                      </td>

                      <td className={`py-2 px-3 whitespace-nowrap ${textSub}`}>
                        +{allowT} × +{allowW} мм
                      </td>

                      <td className={`py-2 px-3 whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                        {sawT} × {sawW} мм
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={250}
                            value={s.pricePerM3}
                            onChange={(e) =>
                              handlePriceChange(
                                s.thickness,
                                s.width,
                                Number(e.target.value) || 0
                              )
                            }
                            className={`w-24 px-1.5 py-0.5 rounded font-semibold focus:outline-none ${inputCls}`}
                          />
                          <span className={`text-[11px] ${textSub}`}>₽</span>
                        </div>
                      </td>

                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={s.priceSource}
                          onChange={(e) =>
                            handleSourceChange(s.thickness, s.width, e.target.value)
                          }
                          className={`w-full min-w-[220px] px-2 py-0.5 rounded text-xs focus:outline-none ${inputCls}`}
                        />
                      </td>

                      <td className={`py-2 px-3 ${textSub}`}>
                        <input
                          type="date"
                          value={s.priceDate}
                          onChange={(e) =>
                            handleDateChange(s.thickness, s.width, e.target.value)
                          }
                          className={`px-1.5 py-0.5 rounded text-xs focus:outline-none ${inputCls}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
