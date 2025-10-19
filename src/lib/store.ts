import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { AnyDuctPart, Camera, Point, Fittings, ConfirmModalContent, Dimension, SnapPoint, FittingItem } from './types';
import { getDefaultFittings } from './default-fittings';

const FITTINGS_STORAGE_KEY = 'ductAppFittings';

export interface DimensionModalContent {
  p1: SnapPoint;
  p2: SnapPoint;
}

export interface DuctState {
  objects: AnyDuctPart[];
  camera: Camera;
  selectedObjectId: number | null;
  mode: 'pan' | 'measure';
  isConfirmModalOpen: boolean;
  confirmModalContent: ConfirmModalContent;
  fittings: Fittings;
  isContextMenuOpen: boolean;
  contextMenuPosition: { x: number; y: number };
  measurePoints: SnapPoint[];
  mouseWorldPos: Point | null;
  dimensions: Dimension[];
  isDimensionModalOpen: boolean;
  dimensionModalContent: DimensionModalContent | null;
  isFittingsModalOpen: boolean;
}

export interface DuctActions {
  addObject: (part: AnyDuctPart) => void;
  moveObject: (objectId: number, newPosition: Point) => void;
  clearCanvas: () => void;
  deleteSelectedObject: () => void;
  rotateSelectedObject: () => void;
  flipSelectedObject: () => void;
  disconnectSelectedObject: () => void;
  addDimension: (dimension: Dimension) => void;
  setFittings: (fittings: Fittings) => void;
  updateFitting: (category: string, index: number, item: FittingItem) => void;
  addFitting: (category: string) => void;
  deleteFitting: (category: string, index: number) => void;
  setCamera: (camera: Partial<Camera>) => void;
  selectObject: (objectId: number | null) => void;
  setMode: (mode: 'pan' | 'measure') => void;
  openConfirmModal: (content: ConfirmModalContent) => void;
  closeConfirmModal: () => void;
  loadFittings: () => void;
  saveFittings: () => void;
  openContextMenu: (position: { x: number; y: number }) => void;
  closeContextMenu: () => void;
  mergeGroups: (groupA_id: number, groupB_id: number) => void;
  addMeasurePoint: (point: SnapPoint) => void;
  clearMeasurePoints: () => void;
  setMouseWorldPos: (pos: Point | null) => void;
  openDimensionModal: (content: DimensionModalContent) => void;
  closeDimensionModal: () => void;
  openFittingsModal: () => void;
  closeFittingsModal: () => void;
}

const initialState: DuctState = {
  objects: [],
  camera: { x: 0, y: 0, zoom: 1 },
  selectedObjectId: null,
  mode: 'pan',
  isConfirmModalOpen: false,
  confirmModalContent: {
    title: '',
    message: '',
    onConfirm: () => {},
  },
  fittings: {},
  isContextMenuOpen: false,
  contextMenuPosition: { x: 0, y: 0 },
  measurePoints: [],
  mouseWorldPos: null,
  dimensions: [],
  isDimensionModalOpen: false,
  dimensionModalContent: null,
  isFittingsModalOpen: false,
};


export const createDuctStore = () => create<DuctState & DuctActions>()(
  temporal(
    immer((set, get) => ({
      ...initialState,

      addObject: (part) => {
        set((state) => {
          state.objects.push(part);
        });
      },

      moveObject: (objectId, newPosition) => {
        set((state) => {
          const obj = state.objects.find(o => o.id === objectId);
          if (obj) {
            obj.x = newPosition.x;
            obj.y = newPosition.y;
          }
        });
      },

      clearCanvas: () => {
        set((state) => {
          state.objects = [];
        });
      },

      deleteSelectedObject: () => {
        set((state) => {
          if (state.selectedObjectId !== null) {
            state.objects = state.objects.filter(o => o.id !== state.selectedObjectId);
            state.selectedObjectId = null;
            state.isContextMenuOpen = false;
          }
        });
      },

      rotateSelectedObject: () => {
        set((state) => {
          if (state.selectedObjectId !== null) {
            const obj = state.objects.find(o => o.id === state.selectedObjectId);
            if (obj) {
              obj.rotation = (obj.rotation + 45) % 360;
            }
          }
        });
      },

      flipSelectedObject: () => {
        set((state) => {
          if (state.selectedObjectId !== null) {
            const obj = state.objects.find(o => o.id === state.selectedObjectId);
            if (obj) {
              obj.isFlipped = !obj.isFlipped;
            }
          }
        });
      },

      disconnectSelectedObject: () => {
        set((state) => {
          if (state.selectedObjectId !== null) {
            const obj = state.objects.find(o => o.id === state.selectedObjectId);
            if (obj) {
              obj.groupId = obj.id;
            }
          }
        });
      },

      setCamera: (cameraUpdate) => {
        set((state) => {
          state.camera = { ...state.camera, ...cameraUpdate };
        });
      },

      selectObject: (objectId) => {
        set((state) => {
          state.selectedObjectId = objectId;
          state.objects.forEach(obj => {
            obj.isSelected = obj.id === objectId;
          });
        });
      },

      setMode: (mode) => {
        set((state) => {
          state.mode = mode;
        });
      },

      openConfirmModal: (content) => {
        set((state) => {
          state.isConfirmModalOpen = true;
          state.confirmModalContent = content;
        });
      },

      closeConfirmModal: () => {
        set((state) => {
          state.isConfirmModalOpen = false;
        });
      },

      loadFittings: () => {
        if (typeof window === 'undefined') return;
        try {
          const storedFittings = localStorage.getItem(FITTINGS_STORAGE_KEY);
          if (storedFittings) {
            set({ fittings: JSON.parse(storedFittings) });
          } else {
            set({ fittings: getDefaultFittings() });
          }
        } catch (error) {
          console.error("Failed to load fittings:", error);
          set({ fittings: getDefaultFittings() });
        }
      },

      saveFittings: () => {
        if (typeof window === 'undefined') return;
        try {
          const fittings = get().fittings;
          localStorage.setItem(FITTINGS_STORAGE_KEY, JSON.stringify(fittings));
        } catch (error) {
          console.error("Failed to save fittings:", error);
        }
      },

      openContextMenu: (position) => {
        set((state) => {
          state.isContextMenuOpen = true;
          state.contextMenuPosition = position;
        });
      },

      closeContextMenu: () => {
        set((state) => {
          state.isContextMenuOpen = false;
        });
      },

      mergeGroups: (groupA_id, groupB_id) => {
        set((state) => {
          if (groupA_id === groupB_id) return;
          state.objects.forEach(o => {
            if (o.groupId === groupB_id) {
              o.groupId = groupA_id;
            }
          });
        });
      },

      addMeasurePoint: (point) => {
        set((state) => {
          state.measurePoints.push(point);
        });
      },

      clearMeasurePoints: () => {
        set((state) => {
          state.measurePoints = [];
        });
      },

      setMouseWorldPos: (pos) => {
        set((state) => {
          state.mouseWorldPos = pos;
        });
      },

      addDimension: (dimension) => {
        set((state) => {
          state.dimensions.push(dimension);
        });
      },

      setFittings: (fittings) => {
        set((state) => {
          state.fittings = fittings;
        });
      },

      openDimensionModal: (content) => {
        set((state) => {
          state.isDimensionModalOpen = true;
          state.dimensionModalContent = content;
        });
      },

      closeDimensionModal: () => {
        set((state) => {
          state.isDimensionModalOpen = false;
          state.dimensionModalContent = null;
          state.measurePoints = [];
        });
      },

      openFittingsModal: () => {
        set({ isFittingsModalOpen: true });
      },

      closeFittingsModal: () => {
        set({ isFittingsModalOpen: false });
      },

      updateFitting: (category, index, item) => {
        set((state) => {
          state.fittings[category][index] = item;
        });
      },

      addFitting: (category) => {
        set((state) => {
          const newItem: FittingItem = {
            id: `${category}-${Date.now()}`,
            name: 'New Fitting',
            diameter: 100,
            visible: true,
          };
          state.fittings[category].push(newItem);
        });
      },

      deleteFitting: (category, index) => {
        set((state) => {
          state.fittings[category].splice(index, 1);
        });
      },
    })),
    {
      partialize: (state) => ({ objects: state.objects }),
    }
  )
);
