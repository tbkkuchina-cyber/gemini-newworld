import { atom } from 'jotai';
// Point, Fittings などをインポート
import { AnyDuctPart, Camera, Point, Fittings, ConfirmModalContent, Dimension, SnapPoint, FittingItem, DuctPartType, DragState, StraightDuct, Connector, IntersectionPoint } from './types';
import { getDefaultFittings } from './default-fittings';
// createDuctPart をインポート
import { createDuctPart } from './duct-models';
// getLegLength を useCanvasInteraction から移動させる場合、ここか別ファイルにインポート/定義
// import { getLegLength } from './canvas-utils'; // もし canvas-utils に移動した場合

const FITTINGS_STORAGE_KEY = 'ductAppFittings';

// --- Primitive Atoms (変更なし) ---
export const objectsAtom = atom<AnyDuctPart[]>([]);
export const dimensionsAtom = atom<Dimension[]>([]);
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
// dimensionModalContentAtom の型をより具体的に (任意)
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

// --- Notification Atom (変更なし) ---
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


// --- History (Undo/Redo) Atoms (変更なし) ---
type HistoryState = { objects: AnyDuctPart[], dimensions: Dimension[] };
export const historyAtom = atom<HistoryState[]>([]);
export const historyIndexAtom = atom<number>(-1);


// --- Derived Atoms (変更なし) ---
export const selectedObjectAtom = atom((get) => {
  const objects = get(objectsAtom);
  const selectedId = get(selectedObjectIdAtom);
  return objects.find(o => o.id === selectedId) || null;
});
export const canUndoAtom = atom((get) => get(historyIndexAtom) > 0);
export const canRedoAtom = atom((get) => get(historyIndexAtom) < get(historyAtom).length - 1);


// --- Write-only Atoms (Actions) ---

// --- saveStateAtom, undoAtom, redoAtom (変更なし) ---
export const saveStateAtom = atom(null, (get, set) => {
    const objects = get(objectsAtom);
    const dimensions = get(dimensionsAtom);
    const history = get(historyAtom);
    const historyIndex = get(historyIndexAtom);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ objects: structuredClone(objects), dimensions: structuredClone(dimensions) }); // Deep copy state
    set(historyAtom, newHistory);
    set(historyIndexAtom, newHistory.length - 1);
});
export const undoAtom = atom(null, (get, set) => {
    if (get(canUndoAtom)) {
        const newIndex = get(historyIndexAtom) - 1;
        const history = get(historyAtom);
        const { objects, dimensions } = history[newIndex];
        set(objectsAtom, structuredClone(objects)); // Restore deep copy
        set(dimensionsAtom, structuredClone(dimensions));
        set(historyIndexAtom, newIndex);
        set(selectedObjectIdAtom, null); // Clear selection on undo/redo
        set(closeContextMenuAtom);
    }
});
export const redoAtom = atom(null, (get, set) => {
    if (get(canRedoAtom)) {
        const newIndex = get(historyIndexAtom) + 1;
        const history = get(historyAtom);
        const { objects, dimensions } = history[newIndex];
        set(objectsAtom, structuredClone(objects)); // Restore deep copy
        set(dimensionsAtom, structuredClone(dimensions));
        set(historyIndexAtom, newIndex);
        set(selectedObjectIdAtom, null); // Clear selection on undo/redo
        set(closeContextMenuAtom);
    }
});

// --- addObjectAtom, clearCanvasAtom (変更なし) ---
export const addObjectAtom = atom(null, (get, set, part: AnyDuctPart) => {
  // Assign unique ID if not present (might be needed if adding default items)
  const newId = part.id || Date.now();
  const partWithId = { ...part, id: newId, groupId: newId }; // Start in its own group
  set(objectsAtom, (prev) => [...prev, partWithId]);
  set(saveStateAtom); // Save state after adding
});
export const clearCanvasAtom = atom(null, (get, set) => {
    set(objectsAtom, []);
    set(dimensionsAtom, []);
    set(selectedObjectIdAtom, null);
    set(closeContextMenuAtom);
    set(saveStateAtom);
});

// --- [追加] グループ再計算ロジック ---
/**
 * 指定されたオブジェクト配列 (subset) 内の接続を再評価し、
 * 新しい groupId を割り当てて更新された配列を返します。
 * @param subset - グループを再計算するオブジェクトの配列
 * @param allObjects - キャンバス上のすべてのオブジェクト（接続判定用）
 * @returns 更新された groupId を持つ subset のオブジェクト配列
 */
const recalculateGroups = (subset: AnyDuctPart[], allObjects: AnyDuctPart[]): AnyDuctPart[] => {
    const visited = new Set<number>();
    const updatedSubset: AnyDuctPart[] = [];
    const subsetMap = new Map(subset.map(o => [o.id, { ...o }])); // 作業用コピー

    for (const startObj of subset) {
        if (!visited.has(startObj.id)) {
            const newGroupId = startObj.id; // 新しいグループの代表ID
            const queue = [startObj.id];
            visited.add(startObj.id);
            subsetMap.get(startObj.id)!.groupId = newGroupId;

            let head = 0;
            while (head < queue.length) {
                const currentId = queue[head++];
                const currentObj = allObjects.find(o => o.id === currentId); // allObjects から参照
                const currentModel = currentObj ? createDuctPart(currentObj) : null;
                if (!currentModel) continue;

                for (const neighborId of subsetMap.keys()) { // subsetMap 内の未訪問オブジェクトを探す
                    if (!visited.has(neighborId)) {
                        const neighborObj = allObjects.find(o => o.id === neighborId); // allObjects から参照
                        const neighborModel = neighborObj ? createDuctPart(neighborObj) : null;
                        if (!neighborModel) continue;

                        // Check connection between currentModel and neighborModel
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
    // subsetMap の値 (更新されたオブジェクト) を配列にして返す
    return Array.from(subsetMap.values());
};

// --- [修正] deleteSelectedObjectAtom にグループ再計算を追加 ---
export const deleteSelectedObjectAtom = atom(null, (get, set) => {
  const selectedId = get(selectedObjectIdAtom);
  if (selectedId !== null) {
    const allCurrentObjects = get(objectsAtom);
    const objectToDelete = allCurrentObjects.find(o => o.id === selectedId);
    if (!objectToDelete) return;

    const deletedGroupId = objectToDelete.groupId;

    // オブジェクトを削除
    const objectsAfterDelete = allCurrentObjects.filter(o => o.id !== selectedId);

    // 元のグループに属していた他のオブジェクトを取得
    const remainingInGroup = objectsAfterDelete.filter(o => o.groupId === deletedGroupId);

    if (remainingInGroup.length > 0) {
      // グループ再計算を実行
      const recalculatedGroup = recalculateGroups(remainingInGroup, objectsAfterDelete);

      // 再計算結果をマージ
      const finalObjects = objectsAfterDelete.map(obj => {
        const recalculatedVersion = recalculatedGroup.find(r => r.id === obj.id);
        return recalculatedVersion || obj; // 再計算されたものがあれば置き換え
      });
      set(objectsAtom, finalObjects);
    } else {
      // 削除対象しかグループにいなかった場合
      set(objectsAtom, objectsAfterDelete);
    }

    // 関連する寸法線を削除
    set(dimensionsAtom, prev => prev.filter(d => d.p1_objId !== selectedId && d.p2_objId !== selectedId));

    set(selectedObjectIdAtom, null);
    set(closeContextMenuAtom);
    set(saveStateAtom);
  }
});


// --- [修正] rotateSelectedObjectAtom にグループ回転ロジックを追加 ---
export const rotateSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        const currentObjects = get(objectsAtom);
        const selectedObj = currentObjects.find(o => o.id === selectedId);
        if (!selectedObj) return;

        const groupId = selectedObj.groupId;
        const groupObjects = currentObjects.filter(obj => obj.groupId === groupId);
        const rotationAngle = 45; // Degrees

        let updatedObjects: AnyDuctPart[];

        if (groupObjects.length > 1) {
            // Group rotation
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
                    const newRotation = (obj.rotation + rotationAngle + 360) % 360; // Ensure positive rotation
                    return { ...obj, x: newX, y: newY, rotation: newRotation };
                }
                return obj;
            });
        } else {
            // Single object rotation (use model's rotate method if available)
            updatedObjects = currentObjects.map(o => {
                if (o.id === selectedId) {
                    const model = createDuctPart(o);
                    if (model) {
                        model.rotate(); // Use the model's specific rotation logic
                        // Return a *new* object based on the model's updated state
                        return {
                            ...o, // Copy existing properties
                            x: model.x, // Use potentially updated position from model? (Original only changed rotation)
                            y: model.y,
                            rotation: model.rotation,
                            isFlipped: model.isFlipped // Keep flip state consistent if model.rotate modifies it
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

// --- flipSelectedObjectAtom (変更なし) ---
export const flipSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => {
            if (o.id === selectedId) {
                const model = createDuctPart(o);
                if (model) { model.flip(); return { ...o, isFlipped: model.isFlipped, diameter: model.diameter, diameter2: (model as any).diameter2 } as AnyDuctPart; } // Return new object with updated flip state and potentially swapped diameters for reducer
            }
            return o;
        }));
        set(saveStateAtom);
    }
});

// --- [修正] disconnectSelectedObjectAtom にグループ再計算を追加 ---
export const disconnectSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        const allCurrentObjects = get(objectsAtom);
        const objectToDisconnect = allCurrentObjects.find(o => o.id === selectedId);
        if (!objectToDisconnect) return;

        const oldGroupId = objectToDisconnect.groupId;

        // 1. 対象オブジェクトを新しいグループに移動
        const objectsWithDisconnected = allCurrentObjects.map(o =>
            o.id === selectedId ? { ...o, groupId: o.id } : o
        );

        // 2. 元のグループに残ったオブジェクトを取得
        const remainingInGroup = objectsWithDisconnected.filter(o => o.groupId === oldGroupId && o.id !== selectedId);

        if (remainingInGroup.length > 0) {
            // 3. 残ったオブジェクトのグループを再計算
            const recalculatedGroup = recalculateGroups(remainingInGroup, objectsWithDisconnected);

            // 4. 再計算結果をマージ
            const finalObjects = objectsWithDisconnected.map(obj => {
                const recalculatedVersion = recalculatedGroup.find(r => r.id === obj.id);
                return recalculatedVersion || obj;
            });
            set(objectsAtom, finalObjects);
        } else {
            // 元のグループに他にオブジェクトがなかった場合
            set(objectsAtom, objectsWithDisconnected);
        }

        set(saveStateAtom);
        set(closeContextMenuAtom); // コンテキストメニューを閉じる
    }
});


// --- Dimension Helper (変更なし) ---
const getDimensionKey = (dim: Pick<Dimension, 'p1_objId' | 'p1_pointId' | 'p1_pointType' | 'p2_objId' | 'p2_pointId' | 'p2_pointType'>): string => {
    const part1 = `${dim.p1_objId}:${dim.p1_pointType}:${dim.p1_pointId}`;
    const part2 = `${dim.p2_objId}:${dim.p2_pointType}:${dim.p2_pointId}`;
    return [part1, part2].sort().join('|');
};

// --- addOrUpdateDimensionAtom (変更なし) ---
export const addOrUpdateDimensionAtom = atom(null, (get, set, dimensionData: Omit<Dimension, 'id'>) => {
    const currentDimensions = get(dimensionsAtom);
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

// --- addDimensionAtom -> addOrUpdateDimensionAtom を使い、 saveState を呼ぶように修正 ---
export const addDimensionAtom = atom(null, (get, set, dimensionData: Omit<Dimension, 'id'>) => {
    set(addOrUpdateDimensionAtom, dimensionData);
    set(saveStateAtom); // 履歴を保存
});


// --- updateStraightDuctLengthAtom (変更なし) ---
interface UpdateStraightDuctLengthPayload {
    totalDistance: number;
    ductToUpdateId: number;
    lengthToSubtract: number;
    p1_info: SnapPoint; // 計測の始点
    p2_info: SnapPoint; // 計測の終点
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
        set(objectsAtom, updatedObjects);

        const newDimensionData: Omit<Dimension, 'id'> = {
            p1_objId: p1_info.objId, p1_pointId: p1_info.pointId, p1_pointType: p1_info.pointType,
            p2_objId: p2_info.objId, p2_pointId: p2_info.pointId, p2_pointType: p2_info.pointType,
            value: totalDistance
        };
        set(addOrUpdateDimensionAtom, newDimensionData); // addDimensionAtom ではなくこちらを呼ぶ

        set(saveStateAtom);
        set(showNotificationAtom, `直管長を ${finalDuctLength.toFixed(1)} mmに更新しました。`);
    }
);


// --- その他のアトム (変更なし) ---
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
    set(confirmActionAtom, onConfirm); // 関数を直接セット
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