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
  Elbow = 'Elbow',
  Reducer = 'Reducer',
  Branch = 'Branch',
  Cap = 'Cap',
  Tee = 'Tee',
}

export interface IDuctPart<T extends DuctPartType, D = any> {
  id: number;
  groupId: number;
  x: number;
  y: number;
  rotation: number;
  diameter: number;
  systemName: string;
  type: T;
  isSelected: boolean;
  isFlipped: boolean;
  data: D;
  name: string;
}

export interface StraightDuctData {
  start: Point;
  end: Point;
  diameter: number;
  length: number;
}
export interface StraightDuct extends IDuctPart<DuctPartType.Straight, StraightDuctData> {}

export interface ElbowDuctData {
  center: Point;
  startAngle: number;
  endAngle: number;
  radius: number;
  diameter: number;
}
export interface ElbowDuct extends IDuctPart<DuctPartType.Elbow, ElbowDuctData> {}

export interface AdjustableElbowDuctData {
  center: Point;
  startAngle: number;
  endAngle: number;
  radius: number;
  diameter: number;
  angle: number;
}
export interface AdjustableElbowDuct extends IDuctPart<DuctPartType.Elbow, AdjustableElbowDuctData> {}

export interface BranchDuctData {
  mainLength: number;
  mainDiameter: number;
  mainOutletDiameter: number;
  branchLength: number;
  branchDiameter: number;
  intersectionOffset: number;
}
export interface BranchDuct extends IDuctPart<DuctPartType.Branch, BranchDuctData> {}

export interface YBranchDuctData {
  mainLength: number;
  mainDiameter: number;
  mainOutletDiameter: number;
  branchLength: number;
  branchDiameter: number;
  angle: number;
  intersectionOffset: number;
}
export interface YBranchDuct extends IDuctPart<DuctPartType.Branch, YBranchDuctData> {}

export interface YBranchReducerDuct extends IDuctPart<DuctPartType.Branch, YBranchDuctData> {}

export interface ReducerDuctData {
  start: Point;
  end: Point;
  startDiameter: number;
  endDiameter: number;
  length: number;
}
export interface ReducerDuct extends IDuctPart<DuctPartType.Reducer, ReducerDuctData> {}

export interface DamperDuctData {
  length: number;
  diameter: number;
}
export interface DamperDuct extends IDuctPart<DuctPartType.Straight, DamperDuctData> {}

export interface CapDuctData {
  position: Point;
  diameter: number;
}
export interface CapDuct extends IDuctPart<DuctPartType.Cap, CapDuctData> {}

export interface TeeDuctData {
  mainConnection: Point;
  branchConnection: Point;
  mainDiameter: number;
  branchDiameter: number;
  mainLength: number; // Assuming a default length for drawing
  branchLength: number; // Assuming a default length for drawing
}
export interface TeeDuct extends IDuctPart<DuctPartType.Tee, TeeDuctData> {}

export type AnyDuctPart = StraightDuct | ElbowDuct | AdjustableElbowDuct | BranchDuct | YBranchDuct | YBranchReducerDuct | ReducerDuct | DamperDuct | CapDuct | TeeDuct;

export type FittingItem = {
  id: string;
  name: string;
  visible: boolean;
  type: DuctPartType;
  data: StraightDuctData | ElbowDuctData | AdjustableElbowDuctData | BranchDuctData | YBranchDuctData | ReducerDuctData | DamperDuctData | CapDuctData | TeeDuctData;
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
  offset: Point;
}

export interface SnapResult {
  dist: number;
  dx: number;
  dy: number;
  otherObj: AnyDuctPart | null;
}
