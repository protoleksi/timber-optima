import React from 'react';
import { isVerified } from '../engine/gostData';
import { Crosshair, SlidersHorizontal, BarChart3, TreePine, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type TabKey = 'optimizer' | 'portfolio' | 'batch';

interface HeaderProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const { isDark, toggleTheme } = useTheme();

  const tabs = [
    {
      id: 'optimizer' as TabKey,
      label: 'Оптимизатор бревна',
      icon: Crosshair,
    },
    {
      id: 'portfolio' as TabKey,
      label: 'Портфель заказов и цены',
      icon: SlidersHorizontal,
    },
    {
      id: 'batch' as TabKey,
      label: 'Симуляция партии',
      icon: BarChart3,
    },
  ];

  return (
    <header
      className={`border-b sticky top-0 z-30 transition-colors ${
        isDark ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2 sm:py-0 sm:h-14">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${
                isDark ? 'bg-emerald-600' : 'bg-emerald-700'
              }`}
            >
              <TreePine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span
                className={`text-base font-bold tracking-tight ${
                  isDark ? 'text-[#F4F4F5]' : 'text-slate-900'
                }`}
              >
                TimberOptima
              </span>
              <span
                className={`text-xs ml-2 hidden md:inline border-l pl-2 ${
                  isDark
                    ? 'text-zinc-400 border-zinc-700'
                    : 'text-slate-500 border-slate-300'
                }`}
              >
                Оптимизация 2-проходного раскроя пиловочника
              </span>
            </div>
          </div>

          {/* Right Header: Verification Badge + Theme Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isVerified ? (
              <span
                className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded text-[11px] sm:text-xs font-medium border ${
                  isDark
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                <span className="hidden sm:inline">
                  Данные: ГОСТ сверены, цены: открытые прайсы 25.11.2026
                </span>
                <span className="sm:hidden">ГОСТ · прайсы 25.11.26</span>
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded text-[11px] sm:text-xs font-medium border ${
                  isDark
                    ? 'bg-amber-950/40 text-amber-300 border-amber-800/80'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                Черновые данные
              </span>
            )}

            {/* Compact Light / Dark Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-md border transition-colors flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              aria-label="Переключение темы"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Clean Navigation Tabs */}
        <div
          className={`flex space-x-1 sm:space-x-4 border-t -mb-px overflow-x-auto whitespace-nowrap transition-colors ${
            isDark ? 'border-[#27272A]' : 'border-slate-100'
          }`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`shrink-0 flex items-center gap-1.5 sm:gap-2 py-2.5 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? isDark
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-emerald-700 text-emerald-700'
                    : isDark
                    ? 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
