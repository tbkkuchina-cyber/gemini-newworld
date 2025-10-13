import { FittingsData } from './types';

// カテゴリごとの継手のマスターデータ
// デフォルトでは各カテゴリの基本となる1種類のみを用意
export const fittingsMaster: FittingsData = {
    '90°エルボ': [
        { id: 'elbow90-100', name: 'D100', type: 'Elbow90', defaultOptions: { diameter: 100, legLength: 100 }, visible: true },
    ],
    '45°エルボ': [
        { id: 'elbow45-100', name: 'D100 45°', type: 'AdjustableElbow', defaultOptions: { diameter: 100, legLength: 40, angle: 135 }, visible: true },
    ],
    'T字管レジューサー': [
        { id: 'teered-100-100-100', name: 'D100-100-100', type: 'TeeReducer', defaultOptions: { diameter: 100, diameter2: 100, diameter3: 100, length: 250, branchLength: 120, intersectionOffset: 0 }, visible: true },
    ],
    'Y字管レジューサー': [
        { id: 'yred-100-100-100', name: 'D100-100-100', type: 'YBranchReducer', defaultOptions: { diameter: 100, diameter2: 100, diameter3: 100, angle: 45, length: 350, branchLength: 200, intersectionOffset: 0 }, visible: true },
    ],
    '可変角度エルボ': [
        { id: 'adjelbow-100-60', name: 'D100 60°', type: 'AdjustableElbow', defaultOptions: { diameter: 100, legLength: 150, angle: 60 }, visible: false },
    ],
    'レジューサー': [
        { id: 'reducer-100-100', name: 'D100-100', type: 'Reducer', defaultOptions: { diameter: 100, diameter2: 100, length: 150 }, visible: false },
    ],
    'ダンパー': [
        { id: 'damper-100', name: 'VD100', type: 'Damper', defaultOptions: { diameter: 100, length: 100 }, visible: false },
    ],
};