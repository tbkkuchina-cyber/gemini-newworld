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

// --- Notification Atom (新規追加) ---
export const notificationAtom = atom<{ message: string, id: number } | null>(null);
// Write-only atom to show a notification for 3 seconds
export const showNotificationAtom = atom(null, (get, set, message: string) => {
    const id = Date.now();
    set(notificationAtom, { message, id });
    setTimeout(() => {
        // Clear notification only if it's the same one
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

// --- addObjectAtom, clearCanvasAtom, deleteSelectedObjectAtom (変更なし) ---
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
export const deleteSelectedObjectAtom = atom(null, (get, set) => {
  const selectedId = get(selectedObjectIdAtom);
  if (selectedId !== null) {
    const deletedGroupId = get(objectsAtom).find(o => o.id === selectedId)?.groupId;
    set(objectsAtom, (prev) => prev.filter(o => o.id !== selectedId));
    // Remove dimensions connected to the deleted object
    set(dimensionsAtom, prev => prev.filter(d => d.p1_objId !== selectedId && d.p2_objId !== selectedId));
    set(selectedObjectIdAtom, null);
    set(closeContextMenuAtom);
    // Optional: Recalculate groups if the deleted object was part of a larger group
    // This requires a more complex group recalculation logic similar to the original JS
    set(saveStateAtom);
  }
});

// --- rotateSelectedObjectAtom, flipSelectedObjectAtom, disconnectSelectedObjectAtom (変更なし) ---
export const rotateSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => {
            if (o.id === selectedId) {
                const model = createDuctPart(o);
                if (model) { model.rotate(); return { ...model } as AnyDuctPart; }
            }
            return o;
        }));
        set(saveStateAtom);
    }
});
export const flipSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => {
            if (o.id === selectedId) {
                const model = createDuctPart(o);
                if (model) { model.flip(); return { ...model } as AnyDuctPart; }
            }
            return o;
        }));
        set(saveStateAtom);
    }
});
export const disconnectSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        // Simple disconnect: give the object its own group ID
        set(objectsAtom, prev => prev.map(o =>
            o.id === selectedId ? { ...o, groupId: o.id } : o
        ));
        // TODO: Implement group recalculation for the remaining parts of the original group
        set(saveStateAtom);
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

// --- addDimensionAtom (変更なし) ---
export const addDimensionAtom = atom(null, (get, set, dimensionData: Omit<Dimension, 'id'>) => {
    set(addOrUpdateDimensionAtom, dimensionData);
    set(saveStateAtom);
});


// --- updateStraightDuctLengthAtom の定義 (ロジック実装) ---
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

        // --- エラーチェック ---
        if (finalDuctLength < 0) {
            console.error(`Calculation error: Final duct length is negative (${finalDuctLength.toFixed(1)}mm). Aborting update.`);
            set(showNotificationAtom, `計算エラー: 直管長がマイナス(${finalDuctLength.toFixed(1)}mm)になります。`);
            return;
        }

        // --- 移動ロジックの実装 ---
        const ductModel = createDuctPart(ductToUpdate);
        if (!ductModel) return; // Should not happen

        const ductConns = ductModel.getConnectors();
        if (ductConns.length !== 2) return; // Straight duct should have 2 connectors

        // 1. 固定点 (anchor) と移動点 (moving) を決定
        // p1_info (計測始点) に近い方のコネクタを固定点とする
        const distToConn0 = Math.hypot(p1_info.x - ductConns[0].x, p1_info.y - ductConns[0].y);
        const distToConn1 = Math.hypot(p1_info.x - ductConns[1].x, p1_info.y - ductConns[1].y);
        const anchorConnPoint = distToConn0 < distToConn1 ? ductConns[0] : ductConns[1];
        const movingConnPoint = distToConn0 < distToConn1 ? ductConns[1] : ductConns[0];
        const oldLength = ductToUpdate.length;

        // 2. 移動方向ベクトルと移動距離を計算
        // length が 0 の場合も考慮 (ほぼ起こらないはずだが念のため)
        const direction = (oldLength > 0.1)
            ? { x: (movingConnPoint.x - anchorConnPoint.x) / oldLength, y: (movingConnPoint.y - anchorConnPoint.y) / oldLength }
            : { x: Math.cos(ductToUpdate.rotation * Math.PI / 180), y: Math.sin(ductToUpdate.rotation * Math.PI / 180) }; // 長さ0なら回転角度から方向を推定

        const lengthChange = finalDuctLength - oldLength;
        const dx = direction.x * lengthChange;
        const dy = direction.y * lengthChange;

        // 3. 移動対象オブジェクト群を特定 (BFS)
        const objectsToMove = new Set<number>(); // 移動対象の ID を格納
        const queue: number[] = []; // 探索キュー (ID を格納)

        // 移動点に接続されているオブジェクトを探す (ductToUpdate 自身は除く)
        const connectedObjects = currentObjects.filter(o =>
            o.id !== ductToUpdateId &&
            o.groupId === ductToUpdate.groupId && // 同じグループに属している
            createDuctPart(o)?.getConnectors().some(c => Math.hypot(c.x - movingConnPoint.x, c.y - movingConnPoint.y) < 1)
        );

        connectedObjects.forEach(obj => {
            if (!objectsToMove.has(obj.id)) {
                objectsToMove.add(obj.id);
                queue.push(obj.id);
            }
        });

        // BFS で接続されているオブジェクトを辿る
        let head = 0;
        while(head < queue.length) {
            const currentId = queue[head++];
            const currentObj = currentObjects.find(o => o.id === currentId);
            const currentModel = currentObj ? createDuctPart(currentObj) : null;
            if (!currentModel) continue;

            for (const neighbor of currentObjects) {
                // 自分自身、更新対象の直管、既に追加済みのオブジェクトはスキップ
                if (neighbor.id === currentId || neighbor.id === ductToUpdateId || objectsToMove.has(neighbor.id)) continue;

                // 同じグループに属しているかチェック (必須)
                if (neighbor.groupId !== currentObj?.groupId) continue;

                const neighborModel = createDuctPart(neighbor);
                if (!neighborModel) continue;

                // currentModel のコネクタと neighborModel のコネクタが接続しているか確認
                const isConnected = currentModel.getConnectors().some(c1 =>
                    neighborModel.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1)
                );

                if (isConnected) {
                    objectsToMove.add(neighbor.id);
                    queue.push(neighbor.id);
                }
            }
        }

        // 4. objectsAtom を更新
        const updatedObjects = currentObjects.map(obj => {
            // 更新対象の直管
            if (obj.id === ductToUpdateId) {
                // 新しい中心座標を計算: 固定点から新しい長さの半分だけ移動
                const newCenterX = anchorConnPoint.x + direction.x * finalDuctLength / 2;
                const newCenterY = anchorConnPoint.y + direction.y * finalDuctLength / 2;
                return { ...obj, length: finalDuctLength, x: newCenterX, y: newCenterY } as AnyDuctPart;
            }
            // 移動対象のオブジェクト
            if (objectsToMove.has(obj.id)) {
                return { ...obj, x: obj.x + dx, y: obj.y + dy };
            }
            // それ以外のオブジェクト
            return obj;
        });
        set(objectsAtom, updatedObjects);

        // --- 寸法線の追加または更新 ---
        const newDimensionData: Omit<Dimension, 'id'> = {
            p1_objId: p1_info.objId, p1_pointId: p1_info.pointId, p1_pointType: p1_info.pointType,
            p2_objId: p2_info.objId, p2_pointId: p2_info.pointId, p2_pointType: p2_info.pointType,
            value: totalDistance // 全長を寸法値として記録
        };
        set(addOrUpdateDimensionAtom, newDimensionData);

        // --- 履歴を保存 ---
        set(saveStateAtom);

        // --- 成功通知 ---
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
    // Initial load should not save state immediately. Let first action do it.
    // set(saveStateAtom);
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
    // Clearing measure points moved to processMeasurement in useCanvasInteraction
    // set(measurePointsAtom, []);
});
export const openFittingsModalAtom = atom(null, (get, set) => { set(isFittingsModalOpenAtom, true); });
export const closeFittingsModalAtom = atom(null, (get, set) => { set(isFittingsModalOpenAtom, false); });

// Utility function to check connection (needed for BFS)
function isConnected(objA: AnyDuctPart, objB: AnyDuctPart): boolean {
    const modelA = createDuctPart(objA);
    const modelB = createDuctPart(objB);
    if (!modelA || !modelB) return false;

    return modelA.getConnectors().some(cA =>
        modelB.getConnectors().some(cB => Math.hypot(cA.x - cB.x, cA.y - cB.y) < 1)
    );
}
