import { DuctPart, DimensionLine } from './objects';
import { FittingsData } from './fittingsMaster';

// すべてのダクト部品の型を網羅
export type DuctPartType = 
  | 'StraightDuct' 
  | 'Elbow90' 
  | 'AdjustableElbow' 
  | 'TeeReducer' 
  | 'Reducer' 
  | 'YBranch' 
  | 'YBranchReducer' 
  | 'Damper';

// カメラ（視点）の状態を定義
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// ダクト部品のオプション（全クラスのプロパティを網羅）
export interface DuctPartOptions {
  id?: number;
  x?: number;
  y?: number;
  rotation?: number;
  diameter?: number;
  isSelected?: boolean;
  systemName?: string;
  isFlipped?: boolean;
  groupId?: number;
  length?: number;
  legLength?: number;
  angle?: number;
  branchLength?: number;
  intersectionOffset?: number;
  diameter2?: number;
  diameter3?: number;
}

// パレットに表示するアイテムのデータ型を定義
export interface PaletteItemData {
  type: DuctPartType;
  name: string;
  defaultOptions: DuctPartOptions;
}

// 継手のマスターデータの型定義
export interface Fitting extends Omit<PaletteItemData, 'name'> {
    id: string;
    name: string;
    visible: boolean;
}

// 履歴に保存する状態の型
export interface HistoryState {
    objects: DuctPart[];
    dimensions: DimensionLine[];
}

// アプリケーションの操作モード
export type AppMode = 'pan' | 'measure';

// ZustandストアのState（状態）の型定義
export interface AppState {
  objects: DuctPart[];
  dimensions: DimensionLine[];
  camera: Camera;
  isPaletteOpen: boolean;
  nextId: number;
  selectedObjectId: number | null;
  history: HistoryState[];
  historyIndex: number;
  mode: AppMode;
  fittings: FittingsData;
  isFittingsModalOpen: boolean;
}

// ZustandストアのActions（操作）の型定義
export interface AppActions {
  // オブジェクト操作
  addObject: (partType: DuctPartType, options: DuctPartOptions) => void;
  updateObjectPosition: (id: number, x: number, y: number) => void;
  selectObject: (id: number | null) => void;
  deleteObject: (id: number) => void;
  rotateSelectedObject: () => void;
  flipSelectedObject: () => void;
  recalculateGroups: () => void;
  disconnectObject: (id: number) => void;

  // 寸法線操作
  addDimension: (p1: any, p2: any) => void; // ★ とりあえずanyで定義
  updateStraightRunDimensions: () => void;

  // カメラ操作
  panCamera: (dx: number, dy: number) => void;
  zoomCamera: (delta: number, worldMousePos: { x: number; y: number }) => void;
  
  // UI操作
  togglePalette: () => void;
  setMode: (mode: AppMode) => void;
  toggleFittingsModal: () => void;
  saveFittings: (newFittings: FittingsData) => void;

  // 履歴操作
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}