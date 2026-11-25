import { useState } from 'react';
import { Header, TabKey } from './components/Header';
import { LogOptimizer } from './components/LogOptimizer';
import { PricingPortfolio } from './components/PricingPortfolio';
import { BatchSimulation } from './components/BatchSimulation';
import { TreePine } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('optimizer');
  const [priceVersion, setPriceVersion] = useState<number>(0);
  const { isDark } = useTheme();

  const handlePricesUpdated = () => {
    setPriceVersion((v) => v + 1);
  };

  return (
    <div
      className={`min-h-screen flex flex-col overflow-x-hidden font-sans transition-colors selection:bg-emerald-700 selection:text-white ${
        isDark ? 'bg-[#09090B] text-[#F4F4F5]' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Header with Clean Status Badge and Tabs */}
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'optimizer' && (
          <LogOptimizer priceVersion={priceVersion} />
        )}

        {activeTab === 'portfolio' && (
          <PricingPortfolio onPricesUpdated={handlePricesUpdated} />
        )}

        {activeTab === 'batch' && <BatchSimulation />}
      </main>

      {/* Engineering Footer */}
      <footer
        className={`border-t py-5 text-xs mt-12 transition-colors ${
          isDark
            ? 'bg-[#18181B] border-[#27272A] text-zinc-400'
            : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded flex items-center justify-center ${
                isDark
                  ? 'bg-emerald-950/60 text-emerald-300'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <TreePine className="w-3.5 h-3.5" />
            </div>
            <span
              className={`font-semibold ${
                isDark ? 'text-[#F4F4F5]' : 'text-slate-700'
              }`}
            >
              TimberOptima — Программный комплекс оптимизации раскроя пиловочника
            </span>
          </div>

          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${
              isDark ? 'text-zinc-500' : 'text-slate-500'
            }`}
          >
            <span>ГОСТ 24454-80 (пиломатериалы)</span>
            <span>•</span>
            <span>ГОСТ 6782.1-75 (усушка)</span>
            <span>•</span>
            <span>ГОСТ 9463-2025 (пиловочник)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
