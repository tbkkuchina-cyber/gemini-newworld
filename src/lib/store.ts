import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
    DuctPart,
    StraightDuct,
    Elbow90,
    AdjustableElbow,
    TeeReducer,
    Reducer,
    YBranch,
    YBranchReducer,
    Damper,
    DimensionLine,
    Point
} from '@/lib/objects';
import { AppState, AppActions, DuctPartOptions, DuctPartType, SnapPoint } from '@/lib/types';
import { fittingsMaster } from './fittingsMaster';

// Helper function translated from duct-app-script.js
function getLegLength(obj: DuctPart, conn: { id: string | number; type?: string }): number {
    if (!obj || !conn) return 0;
    if (conn.id === 'center') return 0;
    
    switch(obj.type) {
        case 'Elbow90':
        case 'AdjustableElbow':
            return (obj as Elbow90 | AdjustableElbow).legLength;
        case 'TeeReducer':
             if (conn.type === 'branch') return (obj as TeeReducer).branchLength;
             if (conn.id === 0) return (obj as TeeReducer).length / 2 + (obj as TeeReducer).intersectionOffset;
             if (conn.id === 1) return (obj as TeeReducer).length / 2 - (obj as TeeReducer).intersectionOffset;
             return (obj as TeeReducer).length / 2;
        case 'YBranch':
        case 'YBranchReducer':
             if (conn.type === 'branch') return (obj as YBranch).branchLength;
             if (conn.id === 0) return (obj as YBranch).length / 2 + (obj as YBranch).intersectionOffset;
             if (conn.id === 1) return (obj as YBranch).length / 2 - (obj as YBranch).intersectionOffset;
             return (obj as YBranch).length / 2;
        default:
            return 0;
    }
}

const CONNECTION_TOLERANCE = 5;

export const useAppStore = create<AppState & AppActions>()(immer((set, get) => ({
    objects: [],
    dimensions: [],
    camera: { x: 0, y: 0, zoom: 0.8 },
    isPaletteOpen: true,
    nextId: 0,
    selectedObjectId: null,
    history: [{ objects: [], dimensions: [] }],
    historyIndex: 0,
    mode: 'pan',
    fittings: fittingsMaster,
    isFittingsModalOpen: false,
    errorModal: { isOpen: false, title: '', message: '' },
    screenshotTrigger: 0,

    addObject: (partType: DuctPartType, options: DuctPartOptions) => {
        const { nextId, saveHistory, recalculateGroups } = get();
        let newObject: DuctPart;

        const finalOptions = { ...options };

        switch (partType) {
            case 'StraightDuct': newObject = new StraightDuct(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'Elbow90': newObject = new Elbow90(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'AdjustableElbow': newObject = new AdjustableElbow(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'TeeReducer': newObject = new TeeReducer(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'Reducer': newObject = new Reducer(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'YBranch': newObject = new YBranch(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'YBranchReducer': newObject = new YBranchReducer(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            case 'Damper': newObject = new Damper(nextId, finalOptions.x!, finalOptions.y!, finalOptions); break;
            default: return;
        }
        
        set(state => {
            state.objects.push(newObject);
            state.nextId++;
        });
        recalculateGroups();
        saveHistory();
    },

    updateObjectPosition: (id, x, y) => {
        set(state => {
            const obj = state.objects.find(o => o.id === id);
            if (obj) {
                obj.x = x;
                obj.y = y;
            }
        });
    },

    selectObject: (id) => {
        set(state => {
            state.objects.forEach(obj => {
                obj.isSelected = obj.id === id;
            });
            state.selectedObjectId = id;
        });
    },

    deleteObject: (id) => {
        const { recalculateGroups, saveHistory } = get();
        set(state => {
            state.objects = state.objects.filter(o => o.id !== id);
            if (state.selectedObjectId === id) {
                state.selectedObjectId = null;
            }
        });
        recalculateGroups();
        saveHistory();
    },

    rotateSelectedObject: () => {
        const { selectedObjectId, saveHistory, recalculateGroups } = get();
        if (selectedObjectId === null) return;

        set(state => {
            const centerOfRotation = state.objects.find(o => o.id === selectedObjectId);
            if (!centerOfRotation) return;

            const groupToRotate = state.objects.filter(o => o.groupId === centerOfRotation.groupId);
            const angleRad = 45 * Math.PI / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);

            groupToRotate.forEach(obj => {
                obj.rotate();

                if (obj.id !== centerOfRotation.id) {
                    const dx = obj.x - centerOfRotation.x;
                    const dy = obj.y - centerOfRotation.y;
                    obj.x = centerOfRotation.x + (dx * cos - dy * sin);
                    obj.y = centerOfRotation.y + (dx * sin + dy * cos);
                }
            });
        });
        recalculateGroups();
        saveHistory();
    },

    flipSelectedObject: () => {
        const { selectedObjectId, saveHistory } = get();
        if (selectedObjectId === null) return;
        set(state => {
            const obj = state.objects.find(o => o.id === selectedObjectId);
            if (obj) {
                obj.flip();
            }
        });
        saveHistory();
    },

    disconnectObject: (id: number) => {
        const { recalculateGroups, saveHistory } = get();
        set(state => {
            const obj = state.objects.find(o => o.id === id);
            if (obj) {
                obj.groupId = obj.id;
                obj.y += 10;
            }
        });
        recalculateGroups();
        saveHistory();
    },

    mergeGroups: (sourceGroupId, targetGroupId) => {
        set(state => {
            state.objects.forEach(obj => {
                if (obj.groupId === targetGroupId) {
                    obj.groupId = sourceGroupId;
                }
            });
        });
    },

    recalculateGroups: () => {
        set(state => {
            const visited = new Set<number>();
            const objects = state.objects;

            for (const obj of objects) {
                if (visited.has(obj.id)) continue;

                const newGroupId = obj.id;
                const queue: DuctPart[] = [obj];
                visited.add(obj.id);
                obj.groupId = newGroupId;

                while (queue.length > 0) {
                    const currentObj = queue.shift()!;
                    const currentConnectors = currentObj.getConnectors();

                    for (const neighbor of objects) {
                        if (visited.has(neighbor.id)) continue;

                        const neighborConnectors = neighbor.getConnectors();
                        let isConnected = false;

                        for (const c1 of currentConnectors) {
                            for (const c2 of neighborConnectors) {
                                if (c1.diameter === c2.diameter && Math.hypot(c1.x - c2.x, c1.y - c2.y) < CONNECTION_TOLERANCE) {
                                    isConnected = true;
                                    break;
                                }
                            }
                            if (isConnected) break;
                        }

                        if (isConnected) {
                            visited.add(neighbor.id);
                            neighbor.groupId = newGroupId;
                            queue.push(neighbor);
                        }
                    }
                }
            }
        });
        get().updateStraightRunDimensions();
    },

    addDimension: (p1, p2) => {
        set(state => {
            const newDim = new DimensionLine({
                p1_objectId: p1.objectId,
                p1_pointId: p1.id,
                p1_pointType: p1.type,
                p2_objectId: p2.objectId,
                p2_pointId: p2.id,
                p2_pointType: p2.type,
            });
            state.dimensions.push(newDim);
        });
        get().saveHistory();
    },

    updateStraightRunDimensions: () => {
        set(state => {
            const userDimensions = state.dimensions.filter(d => !d.isStraightRun);
            const straightDucts = state.objects.filter(o => o.type === 'StraightDuct') as StraightDuct[];
            
            if (straightDucts.length < 2) {
                state.dimensions = userDimensions;
                return;
            }

            const adj = new Map<number, number[]>();
            straightDucts.forEach(duct => adj.set(duct.id, []));

            for (let i = 0; i < straightDucts.length; i++) {
                for (let j = i + 1; j < straightDucts.length; j++) {
                    const d1 = straightDucts[i];
                    const d2 = straightDucts[j];
                    if (d1.getConnectors().some(c1 => d2.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < CONNECTION_TOLERANCE))) {
                        adj.get(d1.id)?.push(d2.id);
                        adj.get(d2.id)?.push(d1.id);
                    }
                }
            }

            const visited = new Set<number>();
            const newRunDimensions: DimensionLine[] = [];

            for (const duct of straightDucts) {
                if (visited.has(duct.id)) continue;

                const componentIds: number[] = [];
                const queue = [duct.id];
                visited.add(duct.id);

                while (queue.length > 0) {
                    const currentId = queue.shift()!;
                    componentIds.push(currentId);
                    for (const neighborId of adj.get(currentId) || []) {
                        if (!visited.has(neighborId)) {
                            visited.add(neighborId);
                            queue.push(neighborId);
                        }
                    }
                }

                if (componentIds.length < 2) continue;

                const componentObjects = componentIds.map(id => straightDucts.find(d => d.id === id)!);
                const endPoints: SnapPoint[] = [];

                for (const ductInComponent of componentObjects) {
                    for (const connector of ductInComponent.getConnectors()) {
                        const isConnectedToComponentDuct = componentObjects.some(otherDuct => {
                            if (ductInComponent.id === otherDuct.id) return false;
                            return otherDuct.getConnectors().some(otherConnector => Math.hypot(connector.x - otherConnector.x, connector.y - otherConnector.y) < CONNECTION_TOLERANCE);
                        });

                        if (!isConnectedToComponentDuct) {
                            const connectedFitting = state.objects.find(o => 
                                o.type !== 'StraightDuct' && 
                                o.getConnectors().some(c => Math.hypot(c.x - connector.x, c.y - connector.y) < CONNECTION_TOLERANCE)
                            );
                            if (connectedFitting) {
                                const fittingConnector = connectedFitting.getConnectors().find(c => Math.hypot(c.x - connector.x, c.y - connector.y) < CONNECTION_TOLERANCE)!;
                                endPoints.push({ x: fittingConnector.x, y: fittingConnector.y, objectId: connectedFitting.id, id: fittingConnector.id, type: 'connector' });
                            } else {
                                endPoints.push({ x: connector.x, y: connector.y, objectId: ductInComponent.id, id: connector.id, type: 'connector' });
                            }
                        }
                    }
                }
                
                if (endPoints.length === 2) {
                    const [p1, p2] = endPoints;
                    const newDim = new DimensionLine({
                        p1_objectId: p1.objectId,
                        p1_pointId: p1.id,
                        p1_pointType: p1.type,
                        p2_objectId: p2.objectId,
                        p2_pointId: p2.id,
                        p2_pointType: p2.type,
                        isStraightRun: true,
                        id: `run-${componentIds.sort().join('-')}`
                    });
                    newRunDimensions.push(newDim);
                }
            }
            state.dimensions = [...userDimensions, ...newRunDimensions];
        });
    },

    panCamera: (dx, dy) => {
        set(state => {
            state.camera.x -= dx / state.camera.zoom;
            state.camera.y -= dy / state.camera.zoom;
        });
    },

    zoomCamera: (delta, worldMousePos) => {
        const { camera } = get();
        const zoomIntensity = 0.001;
        const oldZoom = camera.zoom;
        const zoomFactor = Math.exp(-delta * zoomIntensity);
        const newZoom = Math.max(0.1, Math.min(oldZoom * zoomFactor, 10));

        const newCamX = worldMousePos.x + (camera.x - worldMousePos.x) * (oldZoom / newZoom);
        const newCamY = worldMousePos.y + (camera.y - worldMousePos.y) * (oldZoom / newZoom);

        set(state => {
            state.camera.x = newCamX;
            state.camera.y = newCamY;
            state.camera.zoom = newZoom;
        });
    },

    // Actions for Toolbar
    zoomIn: () => set(state => { state.camera.zoom *= 1.2 }),
    zoomOut: () => set(state => { state.camera.zoom /= 1.2 }),
    resetView: () => set(state => {
        state.camera.x = 0;
        state.camera.y = 0;
        state.camera.zoom = 0.8;
    }),
    clearCanvas: () => {
        // TODO: Add a confirmation modal before clearing
        set(state => {
            state.objects = [];
            state.dimensions = [];
            state.selectedObjectId = null;
        });
        get().saveHistory();
    },

    applyDimensionAdjustment: (p1_info, p2_info, totalDistance) => {
        set(state => {
            const obj1 = state.objects.find(o => o.id === p1_info.objectId);
            const obj2 = state.objects.find(o => o.id === p2_info.objectId);
            if (!obj1 || !obj2) return;

            let ductToUpdate: StraightDuct | null = null;
            if (obj1.groupId === obj2.groupId) {
                if (obj1.type === 'StraightDuct' && obj1.id === obj2.id) {
                    ductToUpdate = obj1 as StraightDuct;
                } else {
                    const straightDuctsInGroup = state.objects.filter(o => o.groupId === obj1.groupId && o.type === 'StraightDuct');
                    for (const duct of straightDuctsInGroup) {
                        const conns = duct.getConnectors();
                        const connectsTo1 = conns.some(c1 => obj1.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < CONNECTION_TOLERANCE));
                        const connectsTo2 = conns.some(c1 => obj2.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < CONNECTION_TOLERANCE));
                        if (connectsTo1 && connectsTo2) {
                            ductToUpdate = duct as StraightDuct;
                            break;
                        }
                    }
                }
            }

            if (ductToUpdate) {
                const getConnectedLegLength = (fitting: DuctPart, duct: DuctPart) => {
                    if (!fitting || !duct || fitting.type === 'StraightDuct') return 0;
                    const ductConns = duct.getConnectors();
                    const fittingConns = fitting.getConnectors();
                    let relevantConn = null;
                    for (const fc of fittingConns) {
                        if (ductConns.some(dc => Math.hypot(fc.x - dc.x, dc.y - dc.y) < CONNECTION_TOLERANCE)) {
                            relevantConn = fc;
                            break;
                        }
                    }
                    return getLegLength(fitting, relevantConn!);
                };

                const lengthToSubtract = getConnectedLegLength(obj1, ductToUpdate) + getConnectedLegLength(obj2, ductToUpdate);
                const finalDuctLength = totalDistance - lengthToSubtract;

                if (finalDuctLength < 0) {
                    console.error("Error: Calculated duct length is negative.");
                    return; // Abort state change
                }

                const oldLength = ductToUpdate.length;
                const ductConns = ductToUpdate.getConnectors();
                const isP1CloserToConn0 = Math.hypot(p1_info.x - ductConns[0].x, p1_info.y - ductConns[0].y) < Math.hypot(p1_info.x - ductConns[1].x, p1_info.y - ductConns[1].y);
                const anchorConnPoint = isP1CloserToConn0 ? ductConns[0] : ductConns[1];
                const movingConnPoint = isP1CloserToConn0 ? ductConns[1] : ductConns[0];
                
                const direction = (oldLength > 0.1) ? { x: (movingConnPoint.x - anchorConnPoint.x) / oldLength, y: (movingConnPoint.y - anchorConnPoint.y) / oldLength } : {x: Math.cos(ductToUpdate.rotation * Math.PI / 180), y: Math.sin(ductToUpdate.rotation * Math.PI/180)};
                const lengthChange = finalDuctLength - oldLength;
                const dx = direction.x * lengthChange;
                const dy = direction.y * lengthChange;

                const movingBranchRoot = state.objects.find(o => o.id !== ductToUpdate!.id && o.getConnectors().some(c => Math.hypot(c.x - movingConnPoint.x, c.y - movingConnPoint.y) < CONNECTION_TOLERANCE));
                const objectsToMove = new Set<number>();
                if (movingBranchRoot) {
                    const queue = [movingBranchRoot];
                    objectsToMove.add(movingBranchRoot.id);
                    let head = 0;
                    while(head < queue.length){
                        const current = queue[head++]!;
                        for (const neighbor of state.objects) {
                           if (neighbor.groupId === current.groupId && !objectsToMove.has(neighbor.id) && neighbor.id !== ductToUpdate.id) {
                               if (current.getConnectors().some(c1 => neighbor.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < CONNECTION_TOLERANCE))) {
                                   objectsToMove.add(neighbor.id);
                                   queue.push(neighbor);
                               }
                           }
                        }
                    }
                }
                
                state.objects.forEach(obj => {
                    if (objectsToMove.has(obj.id)) {
                        obj.x += dx;
                        obj.y += dy;
                    }
                });
                
                const duct = state.objects.find(o => o.id === ductToUpdate!.id) as StraightDuct;
                if(duct) {
                    duct.length = finalDuctLength;
                    duct.x = anchorConnPoint.x + direction.x * finalDuctLength / 2;
                    duct.y = anchorConnPoint.y + direction.y * finalDuctLength / 2;
                }
            }

            // Add or update the dimension line
            const dimKey = `${[p1_info.objectId, p2_info.objectId].sort().join('-')}`;
            const newDim = new DimensionLine({
                p1_objectId: p1_info.objectId,
                p1_pointId: p1_info.id,
                p1_pointType: p1_info.type,
                p2_objectId: p2_info.objectId,
                p2_pointId: p2_info.id,
                p2_pointType: p2_info.type,
                value: totalDistance,
                id: dimKey
            });
            const existingDimIndex = state.dimensions.findIndex(d => d.id === dimKey);
            if (existingDimIndex > -1) {
                state.dimensions[existingDimIndex] = newDim;
            } else {
                newDim.id = dimKey; // Assign a stable ID
                state.dimensions.push(newDim);
            }
        });
        get().saveHistory();
        get().setMode('pan'); // Exit measure mode after applying dimension
    },

    togglePalette: () => {
        set(state => {
            state.isPaletteOpen = !state.isPaletteOpen;
        });
    },

    setMode: (mode) => {
        set({ mode });
    },

    toggleFittingsModal: () => {
        set(state => {
            state.isFittingsModalOpen = !state.isFittingsModalOpen;
        });
    },

    saveFittings: (newFittings) => {
        set(state => {
            state.fittings = newFittings;
        });
    },

    showErrorModal: (title, message) => {
        set({ errorModal: { isOpen: true, title, message } });
    },

    hideErrorModal: () => {
        set({ errorModal: { isOpen: false, title: '', message: '' } });
    },

    triggerScreenshot: () => {
        set(state => {
            state.screenshotTrigger++;
        });
    },

    saveHistory: () => {
        set(state => {
            const newHistoryEntry = { 
                objects: state.objects.map(obj => obj.clone()),
                dimensions: JSON.parse(JSON.stringify(state.dimensions))
            };
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(newHistoryEntry);
            state.historyIndex = state.history.length - 1;
        });
    },

    undo: () => {
        set(state => {
            if (state.historyIndex > 0) {
                state.historyIndex--;
                const previousState = state.history[state.historyIndex];
                state.objects = previousState.objects.map(obj => obj.clone());
                state.dimensions = previousState.dimensions.map(d => new DimensionLine(d)); // Re-instantiate with new constructor
                state.selectedObjectId = null;
            }
        });
    },

    redo: () => {
        set(state => {
            if (state.historyIndex < state.history.length - 1) {
                state.historyIndex++;
                const nextState = state.history[state.historyIndex];
                state.objects = nextState.objects.map(obj => obj.clone());
                state.dimensions = nextState.dimensions.map(d => new DimensionLine(d)); // Re-instantiate with new constructor
                state.selectedObjectId = null;
            }
        });
    },
})));
