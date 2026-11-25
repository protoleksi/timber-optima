import React from 'react';
import { SawingResult } from '../engine/types';
import { Percent, Banknote, TrendingUp, CircleDot, Info, Layers } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LogKpiProps {
  currentResult: SawingResult;
  baselineResult: SawingResult;
  useShrinkage: boolean;
}

export const LogKpiCards: React.FC<LogKpiProps> = ({
  currentResult,
  baselineResult,
}) => {
  const { isDark } = useTheme();

  const curYield = currentResult.balance.lumberRecoveryRate;
  const baseYield = baselineResult.balance.lumberRecoveryRate;
  const deltaYieldPp = curYield - baseYield;

  const curRev = currentResult.totalRevenue;
  const baseRev = baselineResult.totalRevenue;
  const deltaRevRub = curRev - baseRev;
  const deltaRevPct = baseRev > 0 ? (deltaRevRub / baseRev) * 100 : 0;

  const bal = currentResult.balance;

  const cardCls = isDark
    ? 'bg-[#18181B] border-[#27272A]'
    : 'bg-white border-slate-200';
  const textHead = isDark ? 'text-[#F4F4F5]' : 'text-slate-900';
  const textSub = isDark ? 'text-zinc-400' : 'text-slate-500';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Recovery Rate */}
      <div className={`border rounded-lg p-3.5 shadow-none flex flex-col justify-between transition-colors ${cardCls}`}>
        <div className={`flex items-center justify-between text-xs ${textSub}`}>
          <span>Выход пиломатериалов</span>
          <Percent className="w-3.5 h-3.5 opacity-60" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums whitespace-nowrap ${textHead}`}>
            {curYield.toFixed(1)}%
          </span>
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap border ${
              deltaYieldPp >= 0
                ? isDark
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isDark
                ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {deltaYieldPp >= 0 ? `+${deltaYieldPp.toFixed(1)}` : deltaYieldPp.toFixed(1)} п.п.
          </span>
        </div>
        <div className={`text-[11px] flex justify-between tabular-nums ${textSub}`}>
          <span>База ступени:</span>
          <span className={`font-medium whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
            {baseYield.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 2. Revenue per Log */}
      <div className={`border rounded-lg p-3.5 shadow-none flex flex-col justify-between transition-colors ${cardCls}`}>
        <div className={`flex items-center justify-between text-xs ${textSub}`}>
          <span>Выручка с бревна</span>
          <Banknote className="w-3.5 h-3.5 opacity-60" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums whitespace-nowrap ${textHead}`}>
            {Math.round(curRev).toLocaleString('ru-RU')} ₽
          </span>
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap border ${
              deltaRevRub >= 0
                ? isDark
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isDark
                ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {deltaRevRub >= 0 ? `+${deltaRevPct.toFixed(1)}%` : `${deltaRevPct.toFixed(1)}%`}
          </span>
        </div>
        <div className={`text-[11px] flex justify-between tabular-nums ${textSub}`}>
          <span>Базовая выручка:</span>
          <span className={`font-medium whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
            {Math.round(baseRev).toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      {/* 3. Delta to Baseline */}
      <div className={`border rounded-lg p-3.5 shadow-none flex flex-col justify-between transition-colors ${cardCls}`}>
        <div className={`flex items-center justify-between text-xs ${textSub}`}>
          <span>Прирост к базовому</span>
          <TrendingUp className="w-3.5 h-3.5 opacity-60" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold tabular-nums whitespace-nowrap ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            {deltaRevRub >= 0
              ? `+${Math.round(deltaRevRub).toLocaleString('ru-RU')}`
              : Math.round(deltaRevRub).toLocaleString('ru-RU')}{' '}
            ₽
          </span>
        </div>
        <div className={`text-[11px] flex justify-between tabular-nums ${textSub}`}>
          <span>По объёму:</span>
          <span
            className={`font-medium whitespace-nowrap ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            +{deltaYieldPp.toFixed(1)} п.п.
          </span>
        </div>
      </div>

      {/* 4. Log Raw Volume */}
      <div className={`border rounded-lg p-3.5 shadow-none flex flex-col justify-between transition-colors ${cardCls}`}>
        <div className={`flex items-center justify-between text-xs ${textSub}`}>
          <span>Объём сырья</span>
          <CircleDot className="w-3.5 h-3.5 opacity-60" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums whitespace-nowrap ${textHead}`}>
            {bal.logVolume.toFixed(3)} м³
          </span>
        </div>
        <div className={`text-[11px] flex justify-between tabular-nums ${textSub}`}>
          <span>Пиломатериалы (ном.):</span>
          <span className={`font-medium whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
            {bal.nomBoardsVolume.toFixed(3)} м³
          </span>
        </div>
      </div>
    </div>
  );
};

export const LogBalanceAndTable: React.FC<LogKpiProps> = ({
  currentResult,
  useShrinkage,
}) => {
  const { isDark } = useTheme();
  const bal = currentResult.balance;

  const nomPct = (bal.nomBoardsVolume / bal.logVolume) * 100;
  const shrinkageVol = Math.max(0, bal.rawBoardsVolume - bal.nomBoardsVolume);
  const shrinkagePct = (shrinkageVol / bal.logVolume) * 100;
  const chipsPct = (bal.chipsVolume / bal.logVolume) * 100;
  const sawdustPct = (bal.sawdustVolume / bal.logVolume) * 100;

  // Group boards by nominal section and zone for the table
  interface BoardGroup {
    key: string;
    thickness: number;
    width: number;
    length: number;
    zone: string;
    zoneRaw: string;
    count: number;
    volume: number;
    price: number;
    revenue: number;
  }

  const groupedBoardsMap = new Map<string, BoardGroup>();

  for (const b of currentResult.boards) {
    const nomThick = Math.min(b.nomWidth, b.nomHeight);
    const nomW = Math.max(b.nomWidth, b.nomHeight);
    const key = `${nomThick}x${nomW}x${b.length}-${b.zone}`;
    const zoneName =
      b.zone === 'core'
        ? 'Центральная'
        : b.zone === 'side'
        ? 'Боковая'
        : 'Сбеговая';
    const bVol = (b.nomHeight * b.nomWidth * b.length) / 1_000_000;
    const bRev = bVol * b.pricePerM3;

    if (groupedBoardsMap.has(key)) {
      const g = groupedBoardsMap.get(key)!;
      g.count += 1;
      g.volume += bVol;
      g.revenue += bRev;
    } else {
      groupedBoardsMap.set(key, {
        key,
        thickness: nomThick,
        width: nomW,
        length: b.length,
        zone: zoneName,
        zoneRaw: b.zone,
        count: 1,
        volume: bVol,
        price: b.pricePerM3,
        revenue: bRev,
      });
    }
  }

  const groupedBoards = Array.from(groupedBoardsMap.values()).sort(
    (a, b) => b.thickness - a.thickness || b.width - a.width
  );

  const cardCls = isDark
    ? 'bg-[#18181B] border-[#27272A]'
    : 'bg-white border-slate-200';
  const textHead = isDark ? 'text-[#F4F4F5]' : 'text-slate-800';
  const textSub = isDark ? 'text-zinc-400' : 'text-slate-500';

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Material Balance Card (4 Transparent Segments) */}
      <div className={`border rounded-lg p-4 shadow-none transition-colors ${cardCls}`}>
        <div
          className={`flex items-center justify-between pb-2 border-b text-xs font-semibold ${
            isDark ? 'border-zinc-800' : 'border-slate-100'
          } ${textHead}`}
        >
          <div className="flex items-center gap-2">
            <Layers className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
            <span>Баланс сырья (100% объёма бревна)</span>
          </div>
          <span className={`font-mono text-xs tabular-nums ${textSub}`}>
            Vобщ = {bal.logVolume.toFixed(3)} м³
          </span>
        </div>

        {/* 4-Segment Multi-Color Progress Bar */}
        <div
          className={`w-full h-3.5 rounded overflow-flex my-3 border flex ${
            isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div
            style={{ width: `${nomPct}%` }}
            className={`h-full transition-all ${isDark ? 'bg-emerald-600' : 'bg-emerald-600'}`}
            title={`Пиломатериалы (номинал): ${nomPct.toFixed(1)}%`}
          />
          {useShrinkage && shrinkagePct > 0 && (
            <div
              style={{ width: `${shrinkagePct}%` }}
              className={`h-full transition-all ${isDark ? 'bg-amber-600' : 'bg-amber-500'}`}
              title={`Припуск на усушку: ${shrinkagePct.toFixed(1)}%`}
            />
          )}
          <div
            style={{ width: `${chipsPct}%` }}
            className={`h-full transition-all ${isDark ? 'bg-orange-600' : 'bg-orange-500'}`}
            title={`Технологическая щепа: ${chipsPct.toFixed(1)}%`}
          />
          <div
            style={{ width: `${sawdustPct}%` }}
            className={`h-full transition-all ${isDark ? 'bg-blue-600' : 'bg-blue-600'}`}
            title={`Опилки: ${sawdustPct.toFixed(1)}%`}
          />
        </div>

        {/* Spacious 4-Item Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
          {/* Item 1: Nominal Lumber */}
          <div className="flex flex-col">
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 shrink-0" />
              <span className="truncate">Пиломатериалы (ном.)</span>
            </div>
            <div className={`mt-0.5 pl-4 tabular-nums whitespace-nowrap ${textSub}`}>
              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{nomPct.toFixed(1)}%</strong> ({bal.nomBoardsVolume.toFixed(3)} м³)
            </div>
          </div>

          {/* Item 2: Shrinkage Allowance */}
          <div className="flex flex-col">
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
              <span className="truncate">Припуск на усушку</span>
            </div>
            <div className={`mt-0.5 pl-4 tabular-nums whitespace-nowrap ${textSub}`}>
              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{shrinkagePct.toFixed(1)}%</strong> ({shrinkageVol.toFixed(3)} м³)
            </div>
          </div>

          {/* Item 3: Chips */}
          <div className="flex flex-col">
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 shrink-0" />
              <span className="truncate">Техщепа</span>
            </div>
            <div className={`mt-0.5 pl-4 tabular-nums whitespace-nowrap ${textSub}`}>
              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{chipsPct.toFixed(1)}%</strong> ({bal.chipsVolume.toFixed(3)} м³)
            </div>
          </div>

          {/* Item 4: Sawdust */}
          <div className="flex flex-col">
            <div className={`flex items-center gap-1.5 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 shrink-0" />
              <span className="truncate">Опилки</span>
            </div>
            <div className={`mt-0.5 pl-4 tabular-nums whitespace-nowrap ${textSub}`}>
              <strong className={isDark ? 'text-white' : 'text-slate-900'}>{sawdustPct.toFixed(1)}%</strong> ({bal.sawdustVolume.toFixed(3)} м³)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Full-Width Sawn Boards Specification Table */}
      <div className={`border rounded-lg p-4 shadow-none transition-colors ${cardCls}`}>
        <div
          className={`flex items-center justify-between pb-3 border-b text-xs font-semibold ${
            isDark ? 'border-zinc-800 text-[#F4F4F5]' : 'border-slate-100 text-slate-800'
          }`}
        >
          <span>Спецификация выпиленных досок ({currentResult.boards.length} шт.)</span>
          <span className={`font-mono text-xs tabular-nums whitespace-nowrap ${textSub}`}>
            Итого объём: {bal.nomBoardsVolume.toFixed(3)} м³
          </span>
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className={`border-b font-medium ${
                  isDark
                    ? 'bg-zinc-800/40 text-zinc-400 border-zinc-800'
                    : 'bg-slate-50/60 text-slate-500 border-slate-200'
                }`}
              >
                <th className="py-2 px-3">Сечение (мм)</th>
                <th className="py-2 px-3">Зона</th>
                <th className="py-2 px-3 text-center">Длина (м)</th>
                <th className="py-2 px-3 text-center">Кол-во (шт)</th>
                <th className="py-2 px-3 text-right">Объём ном. (м³)</th>
                <th className="py-2 px-3 text-right">Цена (₽/м³)</th>
                <th className="py-2 px-3 text-right">Выручка (₽)</th>
              </tr>
            </thead>
            <tbody className={`divide-y tabular-nums ${isDark ? 'divide-zinc-800/60' : 'divide-slate-100'}`}>
              {groupedBoards.map((g) => (
                <tr
                  key={g.key}
                  className={`transition ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50/80'}`}
                >
                  <td
                    className={`py-2 px-3 font-bold whitespace-nowrap ${
                      isDark ? 'text-zinc-100' : 'text-slate-900'
                    }`}
                  >
                    {g.thickness}×{g.width}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap border ${
                        g.zoneRaw === 'core'
                          ? isDark
                            ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                          : g.zoneRaw === 'side'
                          ? isDark
                            ? 'bg-blue-950/50 text-blue-300 border-blue-800'
                            : 'bg-blue-100 text-blue-900 border-blue-300'
                          : isDark
                          ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {g.zone}
                    </span>
                  </td>
                  <td className={`py-2 px-3 text-center whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {g.length.toFixed(1)} м
                  </td>
                  <td className={`py-2 px-3 text-center font-bold ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                    {g.count}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>
                    {g.volume.toFixed(4)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${textSub}`}>
                    {g.price.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                    {Math.round(g.revenue).toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className={`border-t-2 font-bold text-xs tabular-nums ${
                  isDark
                    ? 'border-zinc-700 bg-zinc-800/40 text-zinc-100'
                    : 'border-slate-300 bg-slate-50 text-slate-900'
                }`}
              >
                <td colSpan={3} className="py-2.5 px-3">
                  ИТОГО ПИЛОПРОДУКЦИЯ:
                </td>
                <td className="py-2.5 px-3 text-center">
                  {currentResult.boards.length}
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  {bal.nomBoardsVolume.toFixed(3)} м³
                </td>
                <td className="py-2.5 px-3 text-right text-slate-400">—</td>
                <td
                  className={`py-2.5 px-3 text-right whitespace-nowrap ${
                    isDark ? 'text-emerald-400' : 'text-emerald-800'
                  }`}
                >
                  {Math.round(currentResult.lumberRevenue).toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Model Footnote */}
      <div
        className={`flex items-start gap-2 p-3 rounded-lg border text-xs transition-colors ${
          isDark
            ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>Допущение:</strong> Обрезной раскрой без обзола: все 4 угла пильного сечения каждой доски внутри эллипса сечения бревна.
        </p>
      </div>
    </div>
  );
};
