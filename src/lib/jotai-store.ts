import { atom } from 'jotai';
import { AnyDuctPart, Camera, Point, Fittings, ConfirmModalContent, Dimension, SnapPoint, FittingItem, DuctPartType, DragState, StraightDuct, Connector, IntersectionPoint } from './types';
import { getDefaultFittings } from './default-fittings';
import { createDuctPart } from './duct-models';
// ★★★ 修正点: canvas-utils からのインポートを削除 (循環参照の解消) ★★★
// import { getPointForDim } from './canvas-utils'; 

const FITTINGS_STORAGE_KEY = 'ductAppFittings';

// ★★★ 修正点: getPointForDim をストア内にコピー ★★★
// (updateStraightDuctLengthAtom が使用するために必要)
function getPointForDim(objId: number, pointType: 'connector' | 'intersection', pointId: number | string, objects: AnyDuctPart[]): Point | null {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return null;
    const model = createDuctPart(obj);
    if (!model) return null;

    let point: Point | Connector | IntersectionPoint | undefined | null = null;
    if (pointType === 'connector') {
        point = model.getConnectors().find(p => p.id === pointId);
    } else {
        point = model.getIntersectionPoints().find(p => p.id === pointId);
    }

    return point ? { x: point.x, y: point.y } : null;
};

// --- Primitive Atoms ---
export const objectsAtom = atom<AnyDuctPart[]>([]);
export const dimensionsAtom = atom<Dimension[]>([]); // ユーザーが手動で追加した寸法
export const cameraAtom = atom<Camera>({ x: 0, y: 0, zoom: 1 / (1.2 * 1.2) });
export const selectedObjectIdAtom = atom<number | null>(null);
export const modeAtom = atom<'pan' | 'measure'>('pan');
export const isPanningAtom = atom<boolean>(false);
export const dragStateAtom = atom<DragState>({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
export const isClearCanvasModalOpenAtom = atom<boolean>(false);
export const fittingsAtom = atom<Fittings>({});
export const isContextMenuOpenAtom = atom<boolean>(false);
export const contextMenuPositionAtom = atom<{ x: number; y: number }>({ x: 0, y: 0 });
export const measurePointsAtom = atom<SnapPoint[]>([]);
export const mouseWorldPosAtom = atom<Point | null>(null);
export const isDimensionModalOpenAtom = atom<boolean>(false);
export const dimensionModalContentAtom = atom<{
    p1: SnapPoint;
    p2: SnapPoint;
    measuredDistance?: number;
    ductToUpdateId?: number;
    lengthToSubtract?: number;
  } | null>(null);
export const isFittingsModalOpenAtom = atom<boolean>(false);
export const nextIdAtom = atom<number>(0);
export const pendingActionAtom = atom<string | null>(null);

// ★★★ 修正点: 以下のアトムを追加 ★★★
// デフォルトは true (開いた状態) にします
export const isPaletteOpenAtom = atom<boolean>(true);

// --- Notification Atom ---
export const notificationAtom = atom<{ message: string, id: number } | null>(null);
export const showNotificationAtom = atom(null, (get, set, message: string) => {
    const id = Date.now();
    set(notificationAtom, { message, id });
    setTimeout(() => {
        if (get(notificationAtom)?.id === id) {
            set(notificationAtom, null);
        }
    }, 3000);
});


// --- History (Undo/Redo) Atoms ---
type HistoryState = { objects: AnyDuctPart[], dimensions: Dimension[] };
export const historyAtom = atom<HistoryState[]>([]);
export const historyIndexAtom = atom<number>(-1);


// --- Derived Atoms ---
export const selectedObjectAtom = atom((get) => {
  const objects = get(objectsAtom);
  const selectedId = get(selectedObjectIdAtom);
  return objects.find(o => o.id === selectedId) || null;
});
export const canUndoAtom = atom((get) => get(historyIndexAtom) > 0);
export const canRedoAtom = atom((get) => get(historyIndexAtom) < get(historyAtom).length - 1);


// --- (自動計算される赤い補助線) ---
const straightRunDimensionsAtom = atom((get): Dimension[] => {
    const objects = get(objectsAtom);
    const straightDucts = objects.filter(o => o.type === DuctPartType.Straight);
    if (straightDucts.length < 2) {
        return [];
    }

    const adj = new Map<number, number[]>();
    straightDucts.forEach(duct => adj.set(duct.id, []));

    // 1. 直管同士の接続マップを作成
    for (let i = 0; i < straightDucts.length; i++) {
        for (let j = i + 1; j < straightDucts.length; j++) {
            const d1 = straightDucts[i];
            const d2 = straightDucts[j];
            const model1 = createDuctPart(d1);
            const model2 = createDuctPart(d2);
            if (!model1 || !model2) continue;

            if (model1.getConnectors().some(c1 => model2.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1))) {
                adj.get(d1.id)?.push(d2.id);
                adj.get(d2.id)?.push(d1.id);
            }
        }
    }

    const visited = new Set<number>();
    const newRunDimensions: Dimension[] = [];

    // 2. 接続コンポーネント（ラン）を探索
    for (const duct of straightDucts) {
        if (visited.has(duct.id)) continue;

        const componentIds: number[] = [];
        const queue = [duct.id];
        visited.add(duct.id);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            componentIds.push(currentId);
            for (const neighborId of adj.get(currentId)!) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }

        if (componentIds.length < 2) continue; // 2本以上で構成されるランのみ

        const componentObjects = componentIds.map(id => straightDucts.find(d => d.id === id)!);
        const endPoints: (Connector & { objId: number, pointType: 'connector' | 'intersection' })[] = [];

        // 3. ランの「端点」を見つける
        for (const ductInComponent of componentObjects) {
            const ductModel = createDuctPart(ductInComponent)!;
            for (const connector of ductModel.getConnectors()) {
                // このコネクタが「このランの他の直管」に接続されていないか？
                const isConnectedToComponentDuct = componentObjects.some(otherDuct => {
                    if (ductInComponent.id === otherDuct.id) return false;
                    const otherModel = createDuctPart(otherDuct)!;
                    return otherModel.getConnectors().some(otherConnector => Math.hypot(connector.x - otherConnector.x, connector.y - otherConnector.y) < 1);
                });

                if (!isConnectedToComponentDuct) {
                    // 4. 端点に接続されている「継手」を見つける
                    const connectedFitting = objects.find(o => 
                        o.type !== DuctPartType.Straight && 
                        createDuctPart(o)!.getConnectors().some(c => Math.hypot(c.x - connector.x, c.y - connector.y) < 1)
                    );
                    
                    const endObject = connectedFitting || ductInComponent;
                    const endModel = createDuctPart(endObject)!;
                    
                    // (ここからが途切れていた箇所)
                    const endPointInfo = connectedFitting 
                        ? { ...endModel.getConnectors().find(c => Math.hypot(c.x - connector.x, c.y - connector.y) < 1)!, objId: endObject.id, pointType: 'connector' as const } 
                        : { ...connector, objId: endObject.id, pointType: 'connector' as const };

                    endPoints.push(endPointInfo);
                }
            }
        }
        
        // 5. 端点が2つ見つかったら寸法線を作成
        if (endPoints.length === 2) {
            const [p1_info, p2_info] = endPoints;
            const distance = Math.hypot(p2_info.x - p1_info.x, p2_info.y - p1_info.y);

            const newDim: Dimension = {
                p1_objId: p1_info.objId, p1_pointId: p1_info.id, p1_pointType: p1_info.pointType,
                p2_objId: p2_info.objId, p2_pointId: p2_info.id, p2_pointType: p2_info.pointType,
                value: distance,
                isStraightRun: true, // ★ 赤くするためのフラグ
                id: `run-${componentIds.sort().join('-')}`
            };
            
            newRunDimensions.push(newDim);
        }
    }
    return newRunDimensions;
});

// 描画用の「すべての寸法線」アトム
export const allDimensionsAtom = atom((get) => {
    const userDimensions = get(dimensionsAtom);
    const autoRunDimensions = get(straightRunDimensionsAtom);
    return [...userDimensions, ...autoRunDimensions];
});


// --- Write-only Atoms (Actions) ---

export const saveStateAtom = atom(null, (get, set) => {
    const objects = get(objectsAtom);
    const dimensions = get(dimensionsAtom); // 手動寸法のみを保存
    const history = get(historyAtom);
    const historyIndex = get(historyIndexAtom);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ objects: structuredClone(objects), dimensions: structuredClone(dimensions) });
    set(historyAtom, newHistory);
    set(historyIndexAtom, newHistory.length - 1);
});
export const undoAtom = atom(null, (get, set) => {
    if (get(canUndoAtom)) {
        const newIndex = get(historyIndexAtom) - 1;
        const history = get(historyAtom);
        const { objects, dimensions } = history[newIndex];
        set(objectsAtom, structuredClone(objects)); 
        set(dimensionsAtom, structuredClone(dimensions)); // 手動寸法を復元
        set(historyIndexAtom, newIndex);
        set(selectedObjectIdAtom, null); 
        set(closeContextMenuAtom);
    }
});
export const redoAtom = atom(null, (get, set) => {
    if (get(canRedoAtom)) {
        const newIndex = get(historyIndexAtom) + 1;
        const history = get(historyAtom);
        const { objects, dimensions } = history[newIndex];
        set(objectsAtom, structuredClone(objects)); 
        set(dimensionsAtom, structuredClone(dimensions)); // 手動寸法を復元
        set(historyIndexAtom, newIndex);
        set(selectedObjectIdAtom, null); 
        set(closeContextMenuAtom);
    }
});

export const addObjectAtom = atom(null, (get, set, part: AnyDuctPart) => {
  const newId = part.id || Date.now();
  const partWithId = { ...part, id: newId, groupId: newId }; 
  set(objectsAtom, (prev) => [...prev, partWithId]);
  set(saveStateAtom); 
});
export const clearCanvasAtom = atom(null, (get, set) => {
    set(objectsAtom, []);
    set(dimensionsAtom, []);
    set(selectedObjectIdAtom, null);
    set(closeContextMenuAtom);
    set(saveStateAtom);
});

const recalculateGroups = (subset: AnyDuctPart[], allObjects: AnyDuctPart[]): AnyDuctPart[] => {
    const visited = new Set<number>();
    const updatedSubset: AnyDuctPart[] = [];
    const subsetMap = new Map(subset.map(o => [o.id, { ...o }]));
    for (const startObj of subset) {
        if (!visited.has(startObj.id)) {
            const newGroupId = startObj.id; 
            const queue = [startObj.id];
            visited.add(startObj.id);
            subsetMap.get(startObj.id)!.groupId = newGroupId;
            let head = 0;
            while (head < queue.length) {
                const currentId = queue[head++];
                const currentObj = allObjects.find(o => o.id === currentId); 
                const currentModel = currentObj ? createDuctPart(currentObj) : null;
                if (!currentModel) continue;
                for (const neighborId of subsetMap.keys()) { 
                    if (!visited.has(neighborId)) {
                        const neighborObj = allObjects.find(o => o.id === neighborId); 
                        const neighborModel = neighborObj ? createDuctPart(neighborObj) : null;
                        if (!neighborModel) continue;
                        const isConnected = currentModel.getConnectors().some(c1 =>
                            neighborModel.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1)
                        );
                        if (isConnected) {
                            visited.add(neighborId);
                            subsetMap.get(neighborId)!.groupId = newGroupId;
                            queue.push(neighborId);
                        }
                    }
                }
            }
        }
    }
    return Array.from(subsetMap.values());
};
export const deleteSelectedObjectAtom = atom(null, (get, set) => {
  const selectedId = get(selectedObjectIdAtom);
  if (selectedId !== null) {
    const allCurrentObjects = get(objectsAtom);
    const objectToDelete = allCurrentObjects.find(o => o.id === selectedId);
    if (!objectToDelete) return;
    const deletedGroupId = objectToDelete.groupId;
    const objectsAfterDelete = allCurrentObjects.filter(o => o.id !== selectedId);
    const remainingInGroup = objectsAfterDelete.filter(o => o.groupId === deletedGroupId);
    if (remainingInGroup.length > 0) {
      const recalculatedGroup = recalculateGroups(remainingInGroup, objectsAfterDelete);
      const finalObjects = objectsAfterDelete.map(obj => {
        const recalculatedVersion = recalculatedGroup.find(r => r.id === obj.id);
        return recalculatedVersion || obj; 
      });
      set(objectsAtom, finalObjects);
    } else {
      set(objectsAtom, objectsAfterDelete);
    }
    set(dimensionsAtom, prev => prev.filter(d => d.p1_objId !== selectedId && d.p2_objId !== selectedId));
    set(selectedObjectIdAtom, null);
    set(closeContextMenuAtom);
    set(saveStateAtom);
  }
});
export const rotateSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        const currentObjects = get(objectsAtom);
        const selectedObj = currentObjects.find(o => o.id === selectedId);
        if (!selectedObj) return;
        const groupId = selectedObj.groupId;
        const groupObjects = currentObjects.filter(obj => obj.groupId === groupId);
        const rotationAngle = 45; 
        let updatedObjects: AnyDuctPart[];
        if (groupObjects.length > 1) {
            let sumX = 0;
            let sumY = 0;
            groupObjects.forEach(obj => { sumX += obj.x; sumY += obj.y; });
            const centerX = sumX / groupObjects.length;
            const centerY = sumY / groupObjects.length;
            const rad = rotationAngle * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            updatedObjects = currentObjects.map(obj => {
                if (obj.groupId === groupId) {
                    const dx = obj.x - centerX;
                    const dy = obj.y - centerY;
                    const newX = centerX + (dx * cos - dy * sin);
                    const newY = centerY + (dx * sin + dy * cos);
                    const newRotation = (obj.rotation + rotationAngle + 360) % 360; 
                    return { ...obj, x: newX, y: newY, rotation: newRotation };
                }
                return obj;
            });
        } else {
            updatedObjects = currentObjects.map(o => {
                if (o.id === selectedId) {
                    const model = createDuctPart(o);
                    if (model) {
                        model.rotate(); 
                        return {
                            ...o, 
                            x: model.x, 
                            y: model.y,
                            rotation: model.rotation,
                            isFlipped: model.isFlipped 
                        } as AnyDuctPart;
                    }
                }
                return o;
            });
        }
        set(objectsAtom, updatedObjects);
        set(saveStateAtom);
    }
});
export const flipSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => {
            if (o.id === selectedId) {
                const model = createDuctPart(o);
                if (model) { model.flip(); return { ...o, isFlipped: model.isFlipped, diameter: model.diameter, diameter2: (model as any).diameter2 } as AnyDuctPart; } 
            }
            return o;
        }));
        set(saveStateAtom);
    }
});
export const disconnectSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        const allCurrentObjects = get(objectsAtom);
        const objectToDisconnect = allCurrentObjects.find(o => o.id === selectedId);
        if (!objectToDisconnect) return;
        const oldGroupId = objectToDisconnect.groupId;
        const objectsWithDisconnected = allCurrentObjects.map(o =>
            o.id === selectedId ? { ...o, groupId: o.id } : o
        );
        const remainingInGroup = objectsWithDisconnected.filter(o => o.groupId === oldGroupId && o.id !== selectedId);
        if (remainingInGroup.length > 0) {
            const recalculatedGroup = recalculateGroups(remainingInGroup, objectsWithDisconnected);
            const finalObjects = objectsWithDisconnected.map(obj => {
                const recalculatedVersion = recalculatedGroup.find(r => r.id === obj.id);
                return recalculatedVersion || obj;
            });
            set(objectsAtom, finalObjects);
        } else {
            set(objectsAtom, objectsWithDisconnected);
        }
        set(saveStateAtom);
        set(closeContextMenuAtom); 
    }
});

// --- (Dimension Helpers は変更なし) ---
const getDimensionKey = (dim: Pick<Dimension, 'p1_objId' | 'p1_pointId' | 'p1_pointType' | 'p2_objId' | 'p2_pointId' | 'p2_pointType'>): string => {
    const part1 = `${dim.p1_objId}:${dim.p1_pointType}:${dim.p1_pointId}`;
    const part2 = `${dim.p2_objId}:${dim.p2_pointType}:${dim.p2_pointId}`;
    return [part1, part2].sort().join('|');
};
export const addOrUpdateDimensionAtom = atom(null, (get, set, dimensionData: Omit<Dimension, 'id'>) => {
    const currentDimensions = get(dimensionsAtom); // 手動寸法(dimensionsAtom)のみを更新
    const newKey = getDimensionKey(dimensionData);
    const existingDimIndex = currentDimensions.findIndex(d => getDimensionKey(d) === newKey);
    if (existingDimIndex > -1) {
        set(dimensionsAtom, prev => prev.map((dim, index) =>
            index === existingDimIndex ? { ...dim, value: dimensionData.value } : dim
        ));
    } else {
        const newDimension: Dimension = { ...dimensionData, id: `dim-${Date.now()}` };
        set(dimensionsAtom, prev => [...prev, newDimension]);
    }
});
export const addDimensionAtom = atom(null, (get, set, dimensionData: Omit<Dimension, 'id'>) => {
    set(addOrUpdateDimensionAtom, dimensionData);
    set(saveStateAtom); 
});


// --- updateStraightDuctLengthAtom (変更なし - 前回の修正を維持) ---
interface UpdateStraightDuctLengthPayload {
    totalDistance: number;
    ductToUpdateId: number;
    lengthToSubtract: number;
    p1_info: SnapPoint; 
    p2_info: SnapPoint; 
}
export const updateStraightDuctLengthAtom = atom(
    null,
    (get, set, payload: UpdateStraightDuctLengthPayload) => {
        const { totalDistance, ductToUpdateId, lengthToSubtract, p1_info, p2_info } = payload;
        const currentObjects = get(objectsAtom);
        const ductIndex = currentObjects.findIndex(o => o.id === ductToUpdateId && o.type === DuctPartType.Straight);
        const ductToUpdate = currentObjects[ductIndex] as StraightDuct | undefined;

        if (!ductToUpdate) {
            console.error("Duct to update not found or not a straight duct:", ductToUpdateId);
            set(showNotificationAtom, `エラー: 更新対象の直管が見つかりません (ID: ${ductToUpdateId})`);
            return;
        }

        const finalDuctLength = totalDistance - lengthToSubtract;

        if (finalDuctLength < 0) {
            console.error(`Calculation error: Final duct length is negative (${finalDuctLength.toFixed(1)}mm). Aborting update.`);
            set(showNotificationAtom, `計算エラー: 直管長がマイナス(${finalDuctLength.toFixed(1)}mm)になります。`);
            return;
        }

        const ductModel = createDuctPart(ductToUpdate);
        if (!ductModel) return;

        const ductConns = ductModel.getConnectors();
        if (ductConns.length !== 2) return;

        const distToConn0 = Math.hypot(p1_info.x - ductConns[0].x, p1_info.y - ductConns[0].y);
        const distToConn1 = Math.hypot(p1_info.x - ductConns[1].x, p1_info.y - ductConns[1].y);
        const anchorConnPoint = distToConn0 < distToConn1 ? ductConns[0] : ductConns[1];
        const movingConnPoint = distToConn0 < distToConn1 ? ductConns[1] : ductConns[0];
        const oldLength = ductToUpdate.length;

        const direction = (oldLength > 0.1)
            ? { x: (movingConnPoint.x - anchorConnPoint.x) / oldLength, y: (movingConnPoint.y - anchorConnPoint.y) / oldLength }
            : { x: Math.cos(ductToUpdate.rotation * Math.PI / 180), y: Math.sin(ductToUpdate.rotation * Math.PI / 180) };

        const lengthChange = finalDuctLength - oldLength;
        const dx = direction.x * lengthChange;
        const dy = direction.y * lengthChange;

        const objectsToMove = new Set<number>();
        const queue: number[] = [];

        const connectedObjects = currentObjects.filter(o =>
            o.id !== ductToUpdateId &&
            o.groupId === ductToUpdate.groupId &&
            createDuctPart(o)?.getConnectors().some(c => Math.hypot(c.x - movingConnPoint.x, c.y - movingConnPoint.y) < 1)
        );

        connectedObjects.forEach(obj => {
            if (!objectsToMove.has(obj.id)) {
                objectsToMove.add(obj.id);
                queue.push(obj.id);
            }
        });

        let head = 0;
        while(head < queue.length) {
            const currentId = queue[head++];
            const currentObj = currentObjects.find(o => o.id === currentId);
            const currentModel = currentObj ? createDuctPart(currentObj) : null;
            if (!currentModel) continue;

            for (const neighbor of currentObjects) {
                if (neighbor.id === currentId || neighbor.id === ductToUpdateId || objectsToMove.has(neighbor.id)) continue;
                if (neighbor.groupId !== currentObj?.groupId) continue;

                const neighborModel = createDuctPart(neighbor);
                if (!neighborModel) continue;

                const isConnected = currentModel.getConnectors().some(c1 =>
                    neighborModel.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1)
                );

                if (isConnected) {
                    objectsToMove.add(neighbor.id);
                    queue.push(neighbor.id);
                }
            }
        }

        const updatedObjects = currentObjects.map(obj => {
            if (obj.id === ductToUpdateId) {
                const newCenterX = anchorConnPoint.x + direction.x * finalDuctLength / 2;
                const newCenterY = anchorConnPoint.y + direction.y * finalDuctLength / 2;
                return { ...obj, length: finalDuctLength, x: newCenterX, y: newCenterY } as AnyDuctPart;
            }
            if (objectsToMove.has(obj.id)) {
                return { ...obj, x: obj.x + dx, y: obj.y + dy };
            }
            return obj;
        });
        
        const currentDimensions = get(dimensionsAtom); 
        const updatedDimensions = currentDimensions.map(dim => {
            // (ここでストア内の getPointForDim を使用)
            const p1 = getPointForDim(dim.p1_objId, dim.p1_pointType, dim.p1_pointId, updatedObjects);
            const p2 = getPointForDim(dim.p2_objId, dim.p2_pointType, dim.p2_pointId, updatedObjects);
            if (p1 && p2) {
                return { ...dim, value: Math.hypot(p2.x - p1.x, p2.y - p1.y) };
            }
            return dim;
        });
        
        set(dimensionsAtom, updatedDimensions); 
        set(objectsAtom, updatedObjects);       

        const newDimensionData: Omit<Dimension, 'id'> = {
            p1_objId: p1_info.objId, p1_pointId: p1_info.pointId, p1_pointType: p1_info.pointType,
            p2_objId: p2_info.objId, p2_pointId: p2_info.pointId, p2_pointType: p2_info.pointType,
            value: totalDistance,
            isStraightRun: false 
        };
        set(addOrUpdateDimensionAtom, newDimensionData); 

        set(saveStateAtom);
        set(showNotificationAtom, `直管長を ${finalDuctLength.toFixed(1)} mmに更新しました。`);
    }
);


// --- (その他のアトムは変更なし) ---
export const setFittingsAtom = atom(null, (get, set, fittings: Fittings) => { set(fittingsAtom, fittings); });
export const setCameraAtom = atom(null, (get, set, cameraUpdate: Partial<Camera>) => { set(cameraAtom, (prev) => ({ ...prev, ...cameraUpdate })); });
export const selectObjectAtom = atom(null, (get, set, objectId: number | null) => {
    set(selectedObjectIdAtom, objectId);
    set(objectsAtom, prev => prev.map(o => ({ ...o, isSelected: o.id === objectId })));
    if (objectId === null) { set(closeContextMenuAtom); }
});
export const isConfirmModalOpenAtom = atom(false);
export const confirmModalContentAtom = atom<ConfirmModalContent | null>(null);
export const confirmActionAtom = atom<(() => void) | null>(null);
export const openConfirmModalAtom = atom(null, (get, set, { content, onConfirm }: { content: ConfirmModalContent, onConfirm: () => void }) => {
    set(isConfirmModalOpenAtom, true);
    set(confirmModalContentAtom, content);
    set(confirmActionAtom, onConfirm); 
});
export const closeConfirmModalAtom = atom(null, (get, set) => {
    set(isConfirmModalOpenAtom, false);
    set(confirmActionAtom, null);
});
export const loadFittingsAtom = atom(null, (get, set) => {
    if (typeof window === 'undefined') return;
    try {
        const storedFittings = localStorage.getItem(FITTINGS_STORAGE_KEY);
        if (storedFittings) { set(fittingsAtom, JSON.parse(storedFittings)); }
        else { set(fittingsAtom, getDefaultFittings()); }
    } catch (error) {
        console.error("Failed to load fittings:", error);
        set(fittingsAtom, getDefaultFittings());
    }
});
export const saveFittingsAtom = atom(null, (get, set) => {
    if (typeof window === 'undefined') return;
    try {
        const fittings = get(fittingsAtom);
        localStorage.setItem(FITTINGS_STORAGE_KEY, JSON.stringify(fittings));
    } catch (error) { console.error("Failed to save fittings:", error); }
});
export const openContextMenuAtom = atom(null, (get, set, position: { x: number; y: number }) => {
    set(isContextMenuOpenAtom, true);
    set(contextMenuPositionAtom, position);
});
export const closeContextMenuAtom = atom(null, (get, set) => { set(isContextMenuOpenAtom, false); });
export const addMeasurePointAtom = atom(null, (get, set, point: SnapPoint) => { set(measurePointsAtom, prev => [...prev, point]); });
export const clearMeasurePointsAtom = atom(null, (get, set) => { set(measurePointsAtom, []); });
export const openDimensionModalAtom = atom(null, (get, set, content: any) => {
    set(isDimensionModalOpenAtom, true);
    set(dimensionModalContentAtom, content);
});
export const closeDimensionModalAtom = atom(null, (get, set) => {
    set(isDimensionModalOpenAtom, false);
    set(dimensionModalContentAtom, null);
});
export const openFittingsModalAtom = atom(null, (get, set) => { set(isFittingsModalOpenAtom, true); });
export const closeFittingsModalAtom = atom(null, (get, set) => { set(isFittingsModalOpenAtom, false); });

export const triggerScreenshotAtom = atom<number>(0);