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
import { AppState, AppActions, DuctPartOptions, DuctPartType, HistoryState, FittingsData } from '@/lib/types';
import { fittingsMaster } from './fittingsMaster';

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
            const newDim = new DimensionLine(p1, p2);
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
                const endPoints: Point[] = [];

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
                                endPoints.push({ x: fittingConnector.x, y: fittingConnector.y });
                            } else {
                                endPoints.push({ x: connector.x, y: connector.y });
                            }
                        }
                    }
                }
                
                if (endPoints.length === 2) {
                    const [p1, p2] = endPoints;
                    const newDim = new DimensionLine(p1, p2, {
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
                state.dimensions = previousState.dimensions.map(d => new DimensionLine(d.p1, d.p2, d));
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
                state.dimensions = nextState.dimensions.map(d => new DimensionLine(d.p1, d.p2, d));
                state.selectedObjectId = null;
            }
        });
    },
})));
