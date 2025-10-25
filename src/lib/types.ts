export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export enum DuctPartType {
  Straight = 'Straight',

  Elbow90 = 'Elbow90',
  AdjustableElbow = 'AdjustableElbow',
  TeeReducer = 'TeeReducer',
  YBranch = 'YBranch',
  YBranchReducer = 'YBranchReducer',
  Reducer = 'Reducer',
  Damper = 'Damper',

}

// Base interface with common properties, now flat.
export interface IDuctPart {
  id: number;
  groupId: number;
  x: number;
  y: number;
  rotation: number;
  diameter: number;
  systemName: string;
  type: DuctPartType;
  isSelected: boolean;
  isFlipped: boolean;
  name: string;
}

// Specific interfaces extending the base type with their own properties.
export interface StraightDuct extends IDuctPart {
  type: DuctPartType.Straight;
  length: number;
}

export interface Damper extends IDuctPart {
    type: DuctPartType.Damper;
    length: number;
}

export interface Elbow90 extends IDuctPart {
    type: DuctPartType.Elbow90;
    legLength: number;
}

export interface AdjustableElbow extends IDuctPart {
    type: DuctPartType.AdjustableElbow;
    legLength: number;
    angle: number;
}

export interface TeeReducer extends IDuctPart {
    type: DuctPartType.TeeReducer;
    length: number;
    branchLength: number;
    diameter2: number; // Main outlet
    diameter3: number; // Branch
    intersectionOffset: number;
}

export interface YBranch extends IDuctPart {
    type: DuctPartType.YBranch;
    length: number;
    angle: number;
    branchLength: number;
    intersectionOffset: number;
}

export interface YBranchReducer extends YBranch {
    type: DuctPartType.YBranchReducer;
    diameter2: number;
    diameter3: number;
}

export interface Reducer extends IDuctPart {
    type: DuctPartType.Reducer;
    length: number;
    diameter2: number;
}






// A union of all possible duct part types.
export type AnyDuctPart =
  | StraightDuct
  | Damper
  | Elbow90
  | AdjustableElbow
  | TeeReducer
  | YBranch
  | YBranchReducer
  | Reducer;

// FittingItem from the palette, now using a flexible data structure.
export type FittingItem = {
  id: string;
  name: string;
  visible: boolean;
  type: DuctPartType;
  // All possible properties from the vanilla JS fittings are included here.
  diameter?: number;
  legLength?: number;
  angle?: number;
  diameter2?: number;
  diameter3?: number;
  length?: number;
  branchLength?: number;
  intersectionOffset?: number;
};

export type Fittings = Record<string, FittingItem[]>;

export interface Dimension {
  id: string;
  p1_objId: number;
  p1_pointId: number | string;
  p1_pointType: 'connector' | 'intersection';
  p2_objId: number;
  p2_pointId: number | string;
  p2_pointType: 'connector' | 'intersection';
  value: number;
  isStraightRun?: boolean;
}

export interface SnapPoint extends Point {
    objId: number;
    pointId: number | string;
    pointType: 'connector' | 'intersection';
}

export interface Connector extends Point {
  id: number | string;
  angle: number;
  diameter: number;
  type?: 'main' | 'branch';
}

export interface ConfirmModalContent {
  title: string;
  message: string;
}

export interface DragState {
  isDragging: boolean;
  targetId: number | null;
  initialPositions: Map<number, Point> | null;
  offset: Point;
}

export interface SnapResult {
  dist: number;
  dx: number;
  dy: number;
  otherObj: AnyDuctPart | null;
}