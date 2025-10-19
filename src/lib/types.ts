export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export type DuctType = 
  | 'StraightDuct'
  | 'Elbow90'
  | 'AdjustableElbow'
  | 'TeeReducer'
  | 'YBranch'
  | 'YBranchReducer'
  | 'Reducer'
  | 'Damper';

export interface DuctPart<T extends DuctType> {
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
}

export interface StraightDuct extends DuctPart<'StraightDuct'> {
  length: number;
}

export interface Elbow90 extends DuctPart<'Elbow90'> {
  legLength: number;
}

export interface AdjustableElbow extends DuctPart<'AdjustableElbow'> {
  legLength: number;
  angle: number;
}

export interface TeeReducer extends DuctPart<'TeeReducer'> {
  length: number;
  branchLength: number;
  diameter2: number;
  diameter3: number;
  intersectionOffset: number;
}

export interface YBranch<T extends 'YBranch' | 'YBranchReducer'> extends DuctPart<T> {
  length: number;
  angle: number;
  branchLength: number;
  intersectionOffset: number;
}

export interface YBranchReducer extends YBranch<'YBranchReducer'> {
  diameter2: number;
  diameter3: number;
}

export interface Reducer extends DuctPart<'Reducer'> {
  length: number;
  diameter2: number;
}

export interface Damper extends DuctPart<'Damper'> {
  length: number;
}

export type AnyDuctPart = StraightDuct | Elbow90 | AdjustableElbow | TeeReducer | YBranch<'YBranch'> | YBranchReducer | Reducer | Damper;

export interface FittingItem {
  id: string;
  name: string;
  diameter: number;
  visible: boolean;
  legLength?: number;
  angle?: number;
  diameter2?: number;
  diameter3?: number;
  length?: number;
  branchLength?: number;
  intersectionOffset?: number;
}

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
  onConfirm: () => void;
}
