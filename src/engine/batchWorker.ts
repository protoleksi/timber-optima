/**
 * TimberOptima - Web Worker для фоновой пакетной симуляции раскроя
 */

import { OptimizationConfig, WorkerStartMessage } from './types';
import { generateBatch, runBatchSimulation } from './batchSimulator';
import { updateByproductPrice, updateGostSection } from './gostData';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerStartMessage>) => {
  const { type, count, seed, mean, stdDev, config, sections, byproductPrices } =
    event.data;

  if (type === 'start') {
    if (sections && sections.length > 0) {
      for (const s of sections) {
        updateGostSection(s.thickness, s.width, s);
      }
    }
    if (byproductPrices) {
      updateByproductPrice('chips', byproductPrices.chipsPricePerM3);
      updateByproductPrice('sawdust', byproductPrices.sawdustPricePerM3);
    }

    const optConfig: OptimizationConfig = {
      kerf: config?.kerf ?? 3.6,
      useShrinkage: config?.useShrinkage ?? true,
      useTaperBoards: config?.useTaperBoards ?? true,
      rotationStepDeg: config?.rotationStepDeg ?? 15,
      sections: sections ?? config?.sections,
    };

    const logs = generateBatch(
      count,
      seed,
      optConfig.kerf,
      optConfig.useShrinkage,
      optConfig.useTaperBoards,
      mean ?? 220,
      stdDev ?? 35
    );

    const summary = runBatchSimulation(logs, optConfig, seed, (current, total) => {
      ctx.postMessage({
        type: 'progress',
        current,
        total,
        percent: Math.round((current / total) * 100),
      });
    });

    ctx.postMessage({
      type: 'result',
      summary,
    });
  }
};
