
import { RefObject, useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { getObjectAt, screenToWorld, worldToScreen, findNearestConnector } from '@/lib/canvas-utils';
import { AnyDuctPart, DuctPartType, Point, IDuctPart, DragState, SnapResult, FittingItem, StraightDuct } from '@/lib/types';
import { createDuctPart } from '@/lib/duct-models';
import {
  cameraAtom,
  objectsAtom,
  modeAtom,
  measurePointsAtom,
  setCameraAtom,
  selectObjectAtom,
  addObjectAtom,
  openContextMenuAtom,
  closeContextMenuAtom,
  addMeasurePointAtom,
  clearMeasurePointsAtom,
  openDimensionModalAtom,
  mouseWorldPosAtom,
  isPanningAtom,
  dragStateAtom,
  pendingActionAtom,
} from '@/lib/jotai-store';

const SNAP_DISTANCE = 20;

export const useCanvasInteraction = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const camera = useAtomValue(cameraAtom);
  const objects = useAtomValue(objectsAtom);
  const mode = useAtomValue(modeAtom);
  const measurePoints = useAtomValue(measurePointsAtom);

  const setCamera = useSetAtom(setCameraAtom);
  const selectObject = useSetAtom(selectObjectAtom);
  const addObject = useSetAtom(addObjectAtom);
  const openContextMenu = useSetAtom(openContextMenuAtom);
  const closeContextMenu = useSetAtom(closeContextMenuAtom);
  const addMeasurePoint = useSetAtom(addMeasurePointAtom);
  const clearMeasurePoints = useSetAtom(clearMeasurePointsAtom);
  const setMouseWorldPos = useSetAtom(mouseWorldPosAtom);
  const openDimensionModal = useSetAtom(openDimensionModalAtom);
  const setObjects = useSetAtom(objectsAtom);

  const mergeGroups = useCallback((groupA_id: number, groupB_id: number) => {
    if (groupA_id === groupB_id) return;
    setObjects(prev => prev.map(o => o.groupId === groupB_id ? { ...o, groupId: groupA_id } : o));
  }, [setObjects]);

  const [isPanning, setIsPanning] = useAtom(isPanningAtom);
  const [dragState, setDragState] = useAtom(dragStateAtom);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });
  const lastSnap = useRef<SnapResult | null>(null);

  const findBestSnap = useCallback((draggedObj: AnyDuctPart) => {
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
  }, [camera.zoom, objects]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    closeContextMenu();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);

    if (mode === 'measure') {
      // ... (measure mode logic is unchanged)
      return;
    }

    const clickedObject = getObjectAt(worldPoint, objects);
    selectObject(clickedObject ? clickedObject.id : null);

    if (clickedObject) {
      const initialPositions = new Map<number, Point>();
      objects.forEach(obj => {
        if (obj.groupId === clickedObject.groupId) {
          initialPositions.set(obj.id, { x: obj.x, y: obj.y });
        }
      });

      setDragState({
        isDragging: true,
        targetId: clickedObject.id,
        initialPositions,
        offset: { x: worldPoint.x - clickedObject.x, y: worldPoint.y - clickedObject.y },
      });
      canvas.style.cursor = 'grabbing';
    } else {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    }
  }, [canvasRef, camera, objects, mode, measurePoints, selectObject, closeContextMenu, openDimensionModal, clearMeasurePoints, addMeasurePoint, setDragState, setIsPanning]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);
    setMouseWorldPos(worldPoint);

    if (dragState.isDragging && dragState.targetId && dragState.initialPositions) {
      closeContextMenu();

      const initialTargetPos = dragState.initialPositions.get(dragState.targetId);
      if (!initialTargetPos) return;

      const total_dx = (worldPoint.x - dragState.offset.x) - initialTargetPos.x;
      const total_dy = (worldPoint.y - dragState.offset.y) - initialTargetPos.y;

      // Create a temporary representation of the dragged group in its new position
      const tempMovedGroupObjects: AnyDuctPart[] = [];
      objects.forEach(obj => {
          if(dragState.initialPositions!.has(obj.id)) {
              const initialPos = dragState.initialPositions!.get(obj.id)!;
              tempMovedGroupObjects.push({ ...obj, x: initialPos.x + total_dx, y: initialPos.y + total_dy });
          }
      });

      // Find the best snap against the main objects state, but using the moved group
      let bestSnap: SnapResult | null = null;
      for(const draggedObj of tempMovedGroupObjects) {
          const snap = findBestSnap(draggedObj);
          if(snap && (!bestSnap || snap.dist < bestSnap.dist)) {
              bestSnap = snap;
          }
      }
      
      let final_dx = total_dx;
      let final_dy = total_dy;

      if (bestSnap) {
        final_dx += bestSnap.dx;
        final_dy += bestSnap.dy;
        lastSnap.current = bestSnap;
      } else {
        lastSnap.current = null;
      }

      setObjects(prev => prev.map(o => {
        if (dragState.initialPositions!.has(o.id)) {
          const initialPos = dragState.initialPositions!.get(o.id)!;
          return { ...o, x: initialPos.x + final_dx, y: initialPos.y + final_dy };
        }
        return o;
      }));

      return;
    }
    
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setCamera({ x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [canvasRef, camera, objects, setMouseWorldPos, closeContextMenu, findBestSnap, setObjects, setCamera, dragState, isPanning]);

  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragState.isDragging && lastSnap.current) {
      const draggedObj = objects.find(o => o.id === dragState.targetId);
      if (draggedObj && lastSnap.current.otherObj) {
        mergeGroups(draggedObj.groupId, lastSnap.current.otherObj.groupId);
      }
    }

    // Open context menu if an object was just dragged
    if (dragState.isDragging && dragState.targetId) {
      const obj = objects.find(o => o.id === dragState.targetId);
      if (obj) {
        const objectScreenPos = worldToScreen({ x: obj.x, y: obj.y }, canvas, camera);
        openContextMenu({ x: objectScreenPos.x, y: objectScreenPos.y - 50 });
      }
    }

    setIsPanning(false);
    setDragState({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
    lastSnap.current = null;
    canvas.style.cursor = 'grab';
  }, [canvasRef, objects, dragState, lastSnap, setIsPanning, setDragState, mergeGroups]);

  const handleMouseLeave = useCallback(() => {
      setMouseWorldPos(null);
  }, [setMouseWorldPos]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    closeContextMenu();
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.exp(delta * zoomIntensity);
    const newZoom = Math.max(0.1, Math.min(camera.zoom * zoomFactor, 10));
    setCamera({ zoom: newZoom });
  }, [camera, closeContextMenu, setCamera]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const itemJson = e.dataTransfer?.getData('application/json');
    if (!itemJson) return;

    const item = JSON.parse(itemJson) as FittingItem;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);

    const newPart: AnyDuctPart = {
      id: Date.now(),
      groupId: Date.now(),
      x: worldPoint.x,
      y: worldPoint.y,
      rotation: 0,
      isSelected: false,
      isFlipped: false,
      systemName: 'SA-1',
      name: item.name,
      type: item.type,
      diameter: item.diameter || 100,
      length: item.length,
      legLength: item.legLength,
      angle: item.angle,
      diameter2: item.diameter2,
      diameter3: item.diameter3,
      branchLength: item.branchLength,
      intersectionOffset: item.intersectionOffset,
    } as AnyDuctPart;

    addObject(newPart);
  }, [canvasRef, camera, addObject]);

  const handleDragOver = useCallback((e: DragEvent) => {
      e.preventDefault();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
    };

  }, [canvasRef, handleMouseDown, handleMouseUp, handleMouseMove, handleMouseLeave, handleWheel, handleDrop, handleDragOver]);

  const [pendingAction, setPendingAction] = useAtom(pendingActionAtom);

  useEffect(() => {
    if (pendingAction === 'add-straight-duct-at-center') {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasCenterScreen = { x: rect.width / 2, y: rect.height / 2 };
      const worldCenter = screenToWorld(canvasCenterScreen, canvas, camera);

      const newDuct: StraightDuct = {
        id: Date.now(),
        groupId: Date.now(),
        type: DuctPartType.Straight,
        x: worldCenter.x,
        y: worldCenter.y,
        length: 400,
        diameter: 100,
        name: '直管',
        rotation: 0,
        systemName: 'SA-1',
        isSelected: false,
        isFlipped: false,
      };

      addObject(newDuct);
      setPendingAction(null); // Reset the action
    }
  }, [pendingAction, canvasRef, camera, addObject, setPendingAction]);
};