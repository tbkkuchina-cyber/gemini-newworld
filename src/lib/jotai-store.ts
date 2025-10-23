import { atom } from 'jotai';
import { AnyDuctPart, Camera, Point, Fittings, ConfirmModalContent, Dimension, SnapPoint, FittingItem, DuctPartType, DragState } from './types';
import { getDefaultFittings } from './default-fittings';

const FITTINGS_STORAGE_KEY = 'ductAppFittings';

// --- Primitive Atoms (The Source of Truth) ---
export const objectsAtom = atom<AnyDuctPart[]>([]);
export const cameraAtom = atom<Camera>({ x: 0, y: 0, zoom: 1 / (1.2 * 1.2) });
export const selectedObjectIdAtom = atom<number | null>(null);
export const modeAtom = atom<'pan' | 'measure'>('pan');
export const isPanningAtom = atom<boolean>(false);
export const dragStateAtom = atom<DragState>({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
export const isConfirmModalOpenAtom = atom<boolean>(false);
export const confirmModalContentAtom = atom<ConfirmModalContent>({ title: '', message: '' });
export const confirmActionAtom = atom<(() => void) | null>(null);
export const fittingsAtom = atom<Fittings>({});
export const isContextMenuOpenAtom = atom<boolean>(false);
export const contextMenuPositionAtom = atom<{ x: number; y: number }>({ x: 0, y: 0 });
export const measurePointsAtom = atom<SnapPoint[]>([]);
export const mouseWorldPosAtom = atom<Point | null>(null);
export const dimensionsAtom = atom<Dimension[]>([]);
export const isDimensionModalOpenAtom = atom<boolean>(false);
export const dimensionModalContentAtom = atom<any>(null); // Type any to avoid circular dependency issues for now
export const isFittingsModalOpenAtom = atom<boolean>(false);
export const nextIdAtom = atom<number>(0);
export const pendingActionAtom = atom<string | null>(null);

// --- Derived Atoms (Reading State) ---

export const selectedObjectAtom = atom((get) => {
  const objects = get(objectsAtom);
  const selectedId = get(selectedObjectIdAtom);
  return objects.find(o => o.id === selectedId) || null;
});

// --- Write-only Atoms (Actions) ---

export const addObjectAtom = atom(null, (get, set, part: AnyDuctPart) => {
  set(objectsAtom, (prev) => [...prev, part]);
});

export const clearCanvasAtom = atom(null, (get, set) => {
    set(objectsAtom, []);
    set(dimensionsAtom, []);
});

export const deleteSelectedObjectAtom = atom(null, (get, set) => {
  const selectedId = get(selectedObjectIdAtom);
  if (selectedId !== null) {
    set(objectsAtom, (prev) => prev.filter(o => o.id !== selectedId));
    set(selectedObjectIdAtom, null);
    set(isContextMenuOpenAtom, false);
  }
});

export const rotateSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => 
            o.id === selectedId ? { ...o, rotation: (o.rotation + 45) % 360 } : o
        ));
    }
});

export const flipSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => 
            o.id === selectedId ? { ...o, isFlipped: !o.isFlipped } : o
        ));
    }
});

export const disconnectSelectedObjectAtom = atom(null, (get, set) => {
    const selectedId = get(selectedObjectIdAtom);
    if (selectedId !== null) {
        set(objectsAtom, prev => prev.map(o => 
            o.id === selectedId ? { ...o, groupId: o.id } : o
        ));
    }
});

export const addDimensionAtom = atom(null, (get, set, dimension: Dimension) => {
    set(dimensionsAtom, prev => [...prev, dimension]);
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
