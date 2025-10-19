import { RefObject, useEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useDuctStoreContext } from '@/lib/store-provider';
import { getObjectAt, screenToWorld, worldToScreen, findNearestConnector } from '@/lib/canvas-utils';
import { AnyDuctPart, DuctType, Point } from '@/lib/types';
import { createDuctPart } from '@/lib/duct-models';

const categoryToDuctType: Record<string, DuctType> = {
    '90°エルボ': 'Elbow90',
    '45°エルボ': 'AdjustableElbow',
    '可変角度エルボ': 'AdjustableElbow',
    'T字管レジューサー': 'TeeReducer',
    'Y字管レジューサー': 'YBranchReducer',
    'レジューサー': 'Reducer',
    'ダンパー': 'Damper',
};

const SNAP_DISTANCE = 20;

interface DragState {
  isDragging: boolean;
  targetId: number | null;
  offset: Point;
}

interface SnapResult {
  dist: number;
  dx: number;
  dy: number;
  otherObj: AnyDuctPart | null;
}

export const useCanvasInteraction = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const {
    camera,
    objects,
    mode,
    measurePoints,
    setCamera,
    selectObject,
    moveObject,
    addObject,
    openContextMenu,
    closeContextMenu,
    mergeGroups,
    addMeasurePoint,
    clearMeasurePoints,
    setMouseWorldPos,
    openDimensionModal,
  } = useDuctStoreContext((state) => ({
    camera: state.camera,
    objects: state.objects,
    mode: state.mode,
    measurePoints: state.measurePoints,
    setCamera: state.setCamera,
    selectObject: state.selectObject,
    moveObject: state.moveObject,
    addObject: state.addObject,
    openContextMenu: state.openContextMenu,
    closeContextMenu: state.closeContextMenu,
    mergeGroups: state.mergeGroups,
    addMeasurePoint: state.addMeasurePoint,
    clearMeasurePoints: state.clearMeasurePoints,
    setMouseWorldPos: state.setMouseWorldPos,
    openDimensionModal: state.openDimensionModal,
  }));

  const isPanning = useRef(false);
  const dragState = useRef<DragState>({ isDragging: false, targetId: null, offset: { x: 0, y: 0 } });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const lastSnap = useRef<SnapResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const findBestSnap = (draggedObj: AnyDuctPart) => {
      let bestSnap: SnapResult = { dist: Infinity, dx: 0, dy: 0, otherObj: null };
      const snapDist = SNAP_DISTANCE / camera.zoom;

      const draggedModel = createDuctPart(draggedObj);
      if (!draggedModel) return null;

      for (const draggedConnector of draggedModel.getConnectors()) {
        for (const staticObj of objects) {
          if (staticObj.groupId === draggedObj.groupId) continue;

          const staticModel = createDuctPart(staticObj);
          if (!staticModel) continue;

          for (const staticConnector of staticModel.getConnectors()) {
            if (draggedConnector.diameter === staticConnector.diameter) {
              const dist = Math.hypot(draggedConnector.x - staticConnector.x, draggedConnector.y - staticConnector.y);
              if (dist < snapDist && dist < bestSnap.dist) {
                bestSnap = {
                  dist,
                  dx: staticConnector.x - draggedConnector.x,
                  dy: staticConnector.y - draggedConnector.y,
                  otherObj: staticObj,
                };
              }
            }
          }
        }
      }
      return bestSnap.dist === Infinity ? null : bestSnap;
    };

    const handleMouseDown = (e: MouseEvent) => {
      closeContextMenu();
      const rect = canvas.getBoundingClientRect();
      const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPoint = screenToWorld(screenPoint, canvas, camera);

      if (mode === 'measure') {
        const snapPoint = findNearestConnector(worldPoint, objects, camera);
        if (snapPoint) {
          const newMeasurePoints = [...measurePoints, snapPoint];
          if (newMeasurePoints.length === 2) {
            openDimensionModal({ p1: newMeasurePoints[0], p2: newMeasurePoints[1] });
            clearMeasurePoints();
          } else {
            addMeasurePoint(snapPoint);
          }
        }
        return;
      }

      const clickedObject = getObjectAt(worldPoint, objects);

      if (clickedObject) {
        selectObject(clickedObject.id);
        dragState.current = {
          isDragging: true,
          targetId: clickedObject.id,
          offset: { x: worldPoint.x - clickedObject.x, y: worldPoint.y - clickedObject.y },
        };
        canvas.style.cursor = 'grabbing';
      } else {
        selectObject(null);
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseUp = () => {
      if (dragState.current.isDragging && lastSnap.current) {
        const draggedObj = objects.find(o => o.id === dragState.current.targetId);
        if (draggedObj && lastSnap.current.otherObj) {
          mergeGroups(draggedObj.groupId, lastSnap.current.otherObj.groupId);
        }
      }

      if (dragState.current.isDragging && dragState.current.targetId) {
        const obj = objects.find(o => o.id === dragState.current.targetId);
        if (obj) {
            const objectScreenPos = worldToScreen({ x: obj.x, y: obj.y }, canvas, camera);
            openContextMenu({ x: objectScreenPos.x, y: objectScreenPos.y - 50 });
        }
      }

      isPanning.current = false;
      dragState.current.isDragging = false;
      lastSnap.current = null;
      canvas.style.cursor = 'grab';
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPoint = screenToWorld(screenPoint, canvas, camera);
      setMouseWorldPos(worldPoint);

      if (dragState.current.isDragging && dragState.current.targetId) {
        closeContextMenu();
        
        let newPosition = {
          x: worldPoint.x - dragState.current.offset.x,
          y: worldPoint.y - dragState.current.offset.y,
        };

        const draggedObj = objects.find(o => o.id === dragState.current.targetId);
        if (draggedObj) {
            const tempMovedObj = { ...draggedObj, x: newPosition.x, y: newPosition.y };
            const snap = findBestSnap(tempMovedObj);
            if (snap) {
                newPosition.x += snap.dx;
                newPosition.y += snap.dy;
                lastSnap.current = snap;
            } else {
                lastSnap.current = null;
            }
        }

        moveObject(dragState.current.targetId, newPosition);
        return;
      }
      
      if (!isPanning.current) return;

      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      setCamera({
        x: camera.x + dx / camera.zoom,
        y: camera.y + dy / camera.zoom,
      });

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
        setMouseWorldPos(null);
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      closeContextMenu();
      const zoomIntensity = 0.1;
      const delta = e.deltaY > 0 ? -1 : 1;
      const zoomFactor = Math.exp(delta * zoomIntensity);
      const newZoom = Math.max(0.1, Math.min(camera.zoom * zoomFactor, 10));
      setCamera({ zoom: newZoom });
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const category = e.dataTransfer?.getData('text/plain');
      const itemJson = e.dataTransfer?.getData('application/json');
      if (!category || !itemJson) return;

      const item = JSON.parse(itemJson);
      const rect = canvas.getBoundingClientRect();
      const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPoint = screenToWorld(screenPoint, canvas, camera);

      const ductType = categoryToDuctType[category] || 'StraightDuct';

      const newPart = {
        ...item,
        id: Date.now(),
        groupId: Date.now(),
        x: worldPoint.x,
        y: worldPoint.y,
        rotation: 0,
        isSelected: false,
        isFlipped: false,
        type: ductType,
      };

      addObject(newPart as AnyDuctPart);
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
    }

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
    };

  }, [canvasRef, camera, objects, mode, measurePoints, addMeasurePoint, clearMeasurePoints, closeContextMenu, mergeGroups, moveObject, openContextMenu, selectObject, setCamera, setMouseWorldPos, openDimensionModal]);
};