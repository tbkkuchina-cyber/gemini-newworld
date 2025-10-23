import { Fittings, DuctPartType, FittingItem } from "./types";

// This data is ported from the reference duct-app-script.js and FLATTENED to match the new type definitions.
export function getDefaultFittings(): Fittings {
    return {
        '90°エルボ': [
            { id: 'elbow90-100', name: 'D100', visible: true, type: DuctPartType.Elbow90, diameter: 100, legLength: 100 },
        ],
        '45°エルボ': [
            { id: 'elbow45-100', name: 'D100', visible: true, type: DuctPartType.Elbow, angle: 135, diameter: 100, legLength: 40 },
        ],
        'T字管レジューサー': [
            { id: 'teered-100-100-100', name: 'D100-100-100', visible: true, type: DuctPartType.TeeReducer, diameter: 100, diameter2: 100, diameter3: 100, length: 250, branchLength: 150, intersectionOffset: 0 },
        ],
        'Y字管レジューサー': [
            { id: 'yred-100-100-100', name: 'D100-100-100', visible: true, type: DuctPartType.YBranchReducer, diameter: 100, diameter2: 100, diameter3: 100, angle: 45, length: 350, branchLength: 200, intersectionOffset: 0 },
        ],
        '可変角度エルボ': [
            { id: 'adjelbow-100-60', name: 'D100 60°', visible: false, type: DuctPartType.AdjustableElbow, diameter: 100, legLength: 150, angle: 60 },
        ],
         'レジューサー': [
            { id: 'reducer-100-100', name: 'D100-100', visible: false, type: DuctPartType.Reducer, diameter: 100, diameter2: 100, length: 150 },
        ],
        'ダンパー': [
            { id: 'damper-100-100', name: 'VD100 L100', visible: false, type: DuctPartType.Damper, diameter: 100, length: 100 },
        ],
    };
}