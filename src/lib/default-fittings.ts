import { Fittings, DuctPartType } from "./types";

export function getDefaultFittings(): Fittings {
    return {
        '90°エルボ': [
            { id: 'elbow90-100', name: 'D100', visible: true, type: DuctPartType.Elbow, data: { center: { x: 0, y: 0 }, startAngle: 0, endAngle: 90, radius: 100, diameter: 100 } },
        ],
        '45°エルボ': [
            { id: 'elbow45-100', name: 'D100', visible: true, type: DuctPartType.Elbow, data: { center: { x: 0, y: 0 }, startAngle: 0, endAngle: 45, radius: 100, diameter: 100 } },
        ],
        'T字管レジューサー': [
            { id: 'teered-100-100-100', name: 'D100-100-100', visible: true, type: DuctPartType.Branch, data: { mainLength: 250, mainDiameter: 100, mainOutletDiameter: 100, branchLength: 150, branchDiameter: 100, intersectionOffset: 0 } },
        ],
        'Y字管レジューサー': [
            { id: 'yred-100-100-100', name: 'D100-100-100', visible: false, type: DuctPartType.Branch, data: { mainLength: 350, mainDiameter: 100, mainOutletDiameter: 100, branchLength: 200, branchDiameter: 100, angle: 45, intersectionOffset: 0 } },
        ],
        '可変角度エルボ': [
            { id: 'adjelbow-100-60', name: 'D100 60°', visible: false, type: DuctPartType.Elbow, data: { center: { x: 0, y: 0 }, startAngle: 0, endAngle: 60, radius: 150, diameter: 100, angle: 60 } },
        ],
         'レジューサー': [
            { id: 'reducer-100-100', name: 'D100-100', visible: false, type: DuctPartType.Reducer, data: { start: { x: 0, y: 0 }, end: { x: 150, y: 0 }, startDiameter: 100, endDiameter: 100, length: 150 } },
        ],
        'ダンパー': [
            { id: 'damper-100-100', name: 'VD100 L100', visible: true, type: DuctPartType.Straight, data: { length: 100, diameter: 100 } },
        ],
        'キャップ': [
            { id: 'cap-100', name: 'D100', visible: true, type: DuctPartType.Cap, data: { position: { x: 0, y: 0 }, diameter: 100 } },
        ],
        'T字管': [
            { id: 'tee-100-100', name: 'D100x100', visible: true, type: DuctPartType.Tee, data: { mainConnection: { x: 0, y: 0 }, branchConnection: { x: 0, y: 0 }, mainDiameter: 100, branchDiameter: 100, mainLength: 200, branchLength: 200 } },
        ],
    };
}
