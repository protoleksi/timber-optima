/**
 * TimberOptima - Calculation Engine Type Definitions
 */

export type BoardZone = 'core' | 'side' | 'taperSide';

export interface BoardSection {
  thickness: number;   // mm (nominal)
  width: number;       // mm (nominal)
  active: boolean;     // whether available for optimization
  pricePerM3: number;  // Rubles per m3
  priceSource: string; // Source reference
  priceDate: string;   // ISO date string
  priceUrl?: string;   // URL источника прайса
  isVerified: boolean; // verification flag
}

export interface ShrinkageAllowance {
  dimension: number;
  allowance: number; // mm
}

export interface LogInput {
  topDiameter: number;    // mm (140 - 420)
  length: number;         // meters (e.g. 4.0, 5.0, 6.0)
  taper: number;          // mm/m (6 - 14)
  ovality: number;        // ratio 0.85 - 1.0 (minor / major axis)
  kerf: number;           // saw kerf mm (2.8 - 5.0, default 3.6)
  useShrinkage: boolean;  // whether to add shrinkage allowance to saw sizes
  useTaperBoards: boolean;// whether to allow shortened side boards in taper zone
  rotationAngle?: number; // log rotation angle in degrees (default 0)
}

export interface Board {
  id: string;
  x: number;          // mm, center X in log cross-section
  y: number;          // mm, center Y in log cross-section
  sawWidth: number;   // mm, actual cutting width (nominal + shrinkage if enabled)
  sawHeight: number;  // mm, actual cutting height/thickness (nominal + shrinkage)
  nomWidth: number;   // mm, standard nominal width
  nomHeight: number;  // mm, standard nominal thickness
  length: number;     // meters
  zStart: number;     // meters, start distance from top end (0 for standard boards)
  zone: BoardZone;    // 'core' | 'side' | 'taperSide'
  pass: 1 | 2;        // 1st pass or 2nd pass
  pricePerM3: number; // Rubles per m3
}

export interface MaterialBalance {
  logVolume: number;       // m3, total log volume (truncated cone)
  nomBoardsVolume: number; // m3, useful commercial volume (nominal sizes)
  rawBoardsVolume: number; // m3, cut volume (actual saw sizes)
  sawdustVolume: number;   // m3, kerf sawdust volume
  chipsVolume: number;     // m3, chips volume = logVolume - rawBoardsVolume - sawdustVolume
  lumberRecoveryRate: number; // % = (nomBoardsVolume / logVolume) * 100
  rawRecoveryRate: number;    // % = (rawBoardsVolume / logVolume) * 100
  balanceError: number;    // |logVolume - (rawBoardsVolume + sawdustVolume + chipsVolume)|
}

export interface SawingResult {
  patternName: string;
  cantThickness: number;
  rotationAngle: number;
  boards: Board[];
  balance: MaterialBalance;
  lumberRevenue: number;   // Rubles
  chipsRevenue: number;    // Rubles
  sawdustRevenue: number;  // Rubles
  totalRevenue: number;    // Rubles
}

export interface BaselineSideBoardSpec {
  thickness: number;
  width: number;
  count: number; // count per side (e.g. 1 board on left and 1 on right)
  length?: number;
}

export interface BaselinePass2BoardSpec {
  thickness: number;
  width: number;
  count: number;
  zone: 'core' | 'side';
}

export interface BaselineEntry {
  diameter: number; // even diameter in mm (140, 160, ...)
  cantThickness: number;
  pass1SideBoards: BaselineSideBoardSpec[];
  pass2Boards: BaselinePass2BoardSpec[];
  isVerified?: boolean;
}

export type OptimizationMode = 'volume' | 'value';

export interface OptimizationConfig {
  kerf: number;
  useShrinkage: boolean;
  useTaperBoards: boolean;
  taperLengths?: number[]; // e.g. [3.0, 4.0]
  rotationStepDeg?: number; // e.g. 15 degrees
  sections?: BoardSection[]; // active/inactive sections & prices override
}

export interface AggregateStats {
  logCount: number;
  totalLogVolume: number;
  totalNomLumberVolume: number;
  totalRawLumberVolume: number;
  totalSawdustVolume: number;
  totalChipsVolume: number;
  averageRecoveryRate: number; // %
  totalRevenue: number;        // Rubles
  lumberRevenue: number;
  chipsRevenue: number;
  sawdustRevenue: number;
}

export interface DiameterGroupStats {
  groupName: string;
  count: number;
  baselineRecoveryRate: number;
  stepDiameterRecoveryRate: number;
  stepRotationRecoveryRate: number;
  adaptiveGeometryRecoveryRate: number;
  adaptiveVolumeRecoveryRate: number;
  adaptiveValueRecoveryRate: number;
  baselineRevenue: number;
  adaptiveValueRevenue: number;
}

export interface SimulationSummary {
  totalLogs: number;
  seed: number;
  baseline: AggregateStats;
  stepDiameter: AggregateStats;       // 2a. Actual diameter (continuous)
  stepRotation: AggregateStats;       // 2b. Actual diameter + rotation
  adaptiveGeometry: AggregateStats;   // 2c. Full geometry (no taper boards)
  adaptiveVolume: AggregateStats;     // 3. Adaptive full volume (with taper boards)
  adaptiveValue: AggregateStats;      // 4. Adaptive value (with taper boards)
  deltaDiameterPercent: number;       // pp vs baseline
  deltaRotationPercent: number;       // pp vs baseline
  deltaGeometryPercent: number;       // pp vs baseline
  deltaVolumePercent: number;         // pp vs baseline
  deltaValueRub: number;              // rub vs baseline
  deltaValuePercent: number;          // % vs baseline
  diameterGroups: DiameterGroupStats[];
}

export interface WorkerProgressMessage {
  type: 'progress';
  current: number;
  total: number;
  percent: number;
}

export interface WorkerResultMessage {
  type: 'result';
  summary: SimulationSummary;
}

export interface WorkerStartMessage {
  type: 'start';
  count: number;
  seed: number;
  mean?: number;
  stdDev?: number;
  config?: Partial<OptimizationConfig>;
  sections?: BoardSection[];
  byproductPrices?: {
    chipsPricePerM3: number;
    sawdustPricePerM3: number;
  };
}
