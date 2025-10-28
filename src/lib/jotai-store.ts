import { atom } from 'jotai';
import { AnyDuctPart, Camera, Point, Fittings, ConfirmModalContent, Dimension, SnapPoint, FittingItem, DuctPartType, DragState } from './types';
import { getDefaultFittings } from './default-fittings';
// duct-models.ts から createDuctPart をインポートします
import { createDuctPart } from './duct-models';

const FITTINGS_STORAGE_KEY = 'ductAppFittings';

// --- Primitive Atoms (The Source of Truth) ---
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
export const dimensionModalContentAtom = atom<any>(null);
export const isFittingsModalOpenAtom = atom<boolean>(false);
export const nextIdAtom = atom<number>(0);
export const pendingActionAtom = atom<string | null>(null);

// --- History (Undo/Redo) Atoms ---
type HistoryState = { objects: AnyDuctPart[], dimensions: Dimension[] };
export const historyAtom = atom<HistoryState[]>([]);
export const historyIndexAtom = atom<number>(-1);


// --- Derived Atoms (Reading State) ---

export const selectedObjectAtom = atom((get) => {
  const objects = get(objectsAtom);
  const selectedId = get(selectedObjectIdAtom);
  return objects.find(o => o.id === selectedId) || null;
});

export const canUndoAtom = atom((get) => get(historyIndexAtom) > 0);
export const canRedoAtom = atom((get) => get(historyIndexAtom) < get(historyAtom).length - 1);


// --- Write-only Atoms (Actions) ---

export const saveStateAtom = atom(null, (get, set) => {
    const objects = get(objectsAtom);
    const dimensions = get(dimensionsAtom);
    const history = get(historyAtom);
    const historyIndex = get(historyIndexAtom);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ objects, dimensions });

    set(historyAtom, newHistory);
    set(historyIndexAtom, newHistory.length - 1);
});

export const undoAtom = atom(null, (get, set) => {
    if (get(canUndoAtom)) {
        const newIndex = get(historyIndexAtom) - 1;
        const history = get(historyAtom);
        const { objects, dimensions } = history[newIndex];
        set(objectsAtom, objects);
        set(dimensionsAtom, dimensions);
        set(historyIndexAtom, newIndex);
    }
});

export const redoAtom = atom(null, (get, set) => {
    if (get(canRedoAtom)) {
        const newIndex = get(historyIndexAtom) + 1;
        const history = get(historyAtom);
        const { objects, dimensions } = history[newIndex];
        set(objectsAtom, objects);
        set(dimensionsAtom, dimensions);
        set(historyIndexAtom, newIndex);
    }
});

export const addObjectAtom = atom(null, (get, set, part: AnyDuctPart) => {
  set(objectsAtom, (prev) => [...prev, part]);
  set(saveStateAtom);
});

export const clearCanvasAtom = atom(null, (get, set) => {
    set(objectsAtom, []);
    set(dimensionsAtom, []);
    set(saveStateAtom);
});

export const deleteSelectedObjectAtom = atom(null, (get, set) => {
  const selectedId = get(selectedObjectIdAtom);
  if (selectedId !== null) {
    set(objectsAtom, (prev) => prev.filter(o => o.id !== selectedId));
    set(selectedObjectIdAtom, null);
    set(isContextMenuOpenAtom, false);
    set(saveStateAtom);
  }
});

/**
 * [修正] 選択されたオブジェクトを回転させます。
 * 単純な回転ロジック (rotation + 45) を適用するのではなく、
 * `createDuctPart` を使ってモデルのインスタンスを作成し、
 * 各モデル固有の `.rotate()` メソッド（AdjustableElbowの特殊なロジックなど）を呼び出します。
 */
export const rotateSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => {
            if (o.id === selectedId) {
                // 1. データからモデルのインスタンスを作成
                const model = createDuctPart(o);
                if (model) {
                    // 2. モデルの .rotate() メソッドを呼び出す
                    model.rotate();
                    // 3. 更新されたモデルのプロパティから新しいプレーンオブジェクトを返す
                    // (model はクラスインスタンスだが、AnyDuctPart と同じプロパティを持つ)
                    return { ...model } as AnyDuctPart;
                }
            }
            return o;
        }));
        set(saveStateAtom);
    }
});

/**
 * [修正] 選択されたオブジェクトを反転させます。
 * 単純な `isFlipped` のトグルだけでなく、
 * `createDuctPart` を使ってモデルのインスタンスを作成し、
 * 各モデル固有の `.flip()` メソッド（Reducerの直径入れ替えロジックなど）を呼び出します。
 */
export const flipSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => {
            if (o.id === selectedId) {
                // 1. データからモデルのインスタンスを作成
                const model = createDuctPart(o);
                if (model) {
                    // 2. モデルの .flip() メソッドを呼び出す
                    model.flip();
                    // 3. 更新されたモデルのプロパティから新しいプレーンオブジェクトを返す
                    return { ...model } as AnyDuctPart;
                }
            }
            return o;
        }));
        set(saveStateAtom);
    }
});

export const disconnectSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => 
            o.id === selectedId ? { ...o, groupId: o.id } : o
        ));
        set(saveStateAtom);
    }
});

export const addDimensionAtom = atom(null, (get, set, dimension: Dimension) => {
    set(dimensionsAtom, prev => [...prev, dimension]);
    set(saveStateAtom);
});

export const setFittingsAtom = atom(null, (get, set, fittings: Fittings) => {
    set(fittingsAtom, fittings);
});

export const setCameraAtom = atom(null, (get, set, cameraUpdate: Partial<Camera>) => {
    set(cameraAtom, (prev) => ({ ...prev, ...cameraUpdate }));
});

export const selectObjectAtom = atom(null, (get, set, objectId: number | null) => {
    set(selectedObjectIdAtom, objectId);
    set(objectsAtom, prev => prev.map(o => ({ ...o, isSelected: o.id === objectId })));
});

// Note: These atoms seem to be missing from your provided file, but are referenced elsewhere.
// Adding them for completeness based on context.
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
        if (storedFittings) {
            set(fittingsAtom, JSON.parse(storedFittings));
        } else {
            set(fittingsAtom, getDefaultFittings());
        }
    } catch (error) {
        console.error("Failed to load fittings:", error);
        set(fittingsAtom, getDefaultFittings());
    }
    set(saveStateAtom); // Save initial state
});

export const saveFittingsAtom = atom(null, (get, set) => {
    if (typeof window === 'undefined') return;
    try {
        const fittings = get(fittingsAtom);
        localStorage.setItem(FITTINGS_STORAGE_KEY, JSON.stringify(fittings));
    } catch (error) {
        console.error("Failed to save fittings:", error);
    }
});

export const openContextMenuAtom = atom(null, (get, set, position: { x: number; y: number }) => {
    set(isContextMenuOpenAtom, true);
    set(contextMenuPositionAtom, position);
});

export const closeContextMenuAtom = atom(null, (get, set) => {
    set(isContextMenuOpenAtom, false);
});

export const addMeasurePointAtom = atom(null, (get, set, point: SnapPoint) => {
    set(measurePointsAtom, prev => [...prev, point]);
});

export const clearMeasurePointsAtom = atom(null, (get, set) => {
    set(measurePointsAtom, []);
});

export const openDimensionModalAtom = atom(null, (get, set, content: any) => {
    set(isDimensionModalOpenAtom, true);
    set(dimensionModalContentAtom, content);
});

export const closeDimensionModalAtom = atom(null, (get, set) => {
    set(isDimensionModalOpenAtom, false);
    set(dimensionModalContentAtom, null);
    set(measurePointsAtom, []);
});

export const openFittingsModalAtom = atom(null, (get, set) => {
    set(isFittingsModalOpenAtom, true);
});

export const closeFittingsModalAtom = atom(null, (get, set) => {
    set(isFittingsModalOpenAtom, false);
});