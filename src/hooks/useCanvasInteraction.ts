import { RefObject, useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { getObjectAt, screenToWorld, worldToScreen, findNearestConnector } from '@/lib/canvas-utils';
import { AnyDuctPart, DuctPartType, Point, IDuctPart, DragState, SnapResult } from '@/lib/types';
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
  setMouseWorldPosAtom,
  openDimensionModalAtom,
  mouseWorldPosAtom,
  isPanningAtom,
  dragStateAtom,
} from '@/lib/jotai-store';

const categoryToDuctType: Record<string, DuctPartType> = {
    '90°エルボ': DuctPartType.Elbow,
    '45°エルボ': DuctPartType.Elbow,
    '可変角度エルボ': DuctPartType.Elbow,
    'T字管レジューサー': DuctPartType.Branch,
    'Y字管レジューサー': DuctPartType.Branch,
    'レジューサー': DuctPartType.Reducer,
    'ダンパー': DuctPartType.Straight,
    'キャップ': DuctPartType.Cap,
    'T字管': DuctPartType.Tee,
};

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
  
  // Actions that modify objects need to be handled carefully
  const setObjects = useSetAtom(objectsAtom);
  const moveObject = useCallback((objectId: number, newPosition: Point) => {
    console.log('moveObject:', { objectId, newPosition });
    setObjects(prev => prev.map(o => o.id === objectId ? { ...o, x: newPosition.x, y: newPosition.y } : o));
  }, [setObjects]);
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

    const draggedModel = createDuctPart(draggedObj.type, draggedObj as Omit<IDuctPart<any>, 'type'>);
    if (!draggedModel) return null;

    for (const draggedConnector of draggedModel.getConnectors()) {
      for (const staticObj of objects) {
        if (staticObj.groupId === draggedObj.groupId) continue;

        const staticModel = createDuctPart(staticObj.type, staticObj as Omit<IDuctPart<any>, 'type'>);
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
  }, [camera, objects]);

      const handleMouseDown = useCallback((e: MouseEvent) => {
        closeContextMenu();
        const canvas = canvasRef.current;
        if (!canvas) return;
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
              console.log('handleMouseDown: clickedObject:', clickedObject);
        
              if (clickedObject) {
                selectObject(clickedObject.id);
                setDragState({
                  isDragging: true,
                  targetId: clickedObject.id,
                  offset: { x: worldPoint.x - clickedObject.x, y: worldPoint.y - clickedObject.y },
                });
                console.log('handleMouseDown: dragState.isDragging after setDragState:', true); // Log the intended state
                canvas.style.cursor = 'grabbing';
              } else {
                selectObject(null);
                setIsPanning(true);
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
              }                  }, [canvasRef, camera, objects, mode, measurePoints, selectObject, closeContextMenu, openDimensionModal, clearMeasurePoints, addMeasurePoint, setDragState, setIsPanning, lastMousePos]);  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragState.isDragging && lastSnap.current) {
      const draggedObj = objects.find(o => o.id === dragState.targetId);
      if (draggedObj && lastSnap.current.otherObj) {
        mergeGroups(draggedObj.groupId, lastSnap.current.otherObj.groupId);
      }
    }

    if (dragState.isDragging && dragState.targetId) {
      const obj = objects.find(o => o.id === dragState.targetId);
      if (obj) {
          const objectScreenPos = worldToScreen({ x: obj.x, y: obj.y }, canvas, camera);
          openContextMenu({ x: objectScreenPos.x, y: objectScreenPos.y - 50 });
      }
    }

    setIsPanning(false);
    setDragState({ isDragging: false, targetId: null, offset: { x: 0, y: 0 } });
    lastSnap.current = null;
    canvas.style.cursor = 'grab';
  }, [canvasRef, camera, objects, dragState, lastSnap, setIsPanning, setDragState, mergeGroups, openContextMenu]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);
    setMouseWorldPos(worldPoint);

    console.log('handleMouseMove:', {
      zoom: camera.zoom,
      isDragging: dragState.isDragging,
      isPanning: isPanning,
      worldPoint: worldPoint,
      screenPoint: screenPoint
    });

    if (dragState.isDragging && dragState.targetId) {
      closeContextMenu();
      
      let newPosition = {
        x: worldPoint.x - dragState.offset.x,
        y: worldPoint.y - dragState.offset.y,
      };

      const draggedObj = objects.find(o => o.id === dragState.targetId);
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

      moveObject(dragState.targetId, newPosition);
      return;
    }
    
    if (!isPanning) return;

                const dx = e.clientX - lastMousePos.current.x;
                const dy = e.clientY - lastMousePos.current.y;
          
                setCamera({
                  x: camera.x + dx / camera.zoom,
                  y: camera.y + dy / camera.zoom,
                });
          
                lastMousePos.current = { x: e.clientX, y: e.clientY };
              }, [canvasRef, camera, objects, mode, setMouseWorldPos, dragState, isPanning, closeContextMenu, findBestSnap, moveObject, setCamera]);  const handleMouseLeave = useCallback(() => {
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

    const category = e.dataTransfer?.getData('text/plain');
    const itemJson = e.dataTransfer?.getData('application/json');
    if (!category || !itemJson) return;

    const item = JSON.parse(itemJson);
          const rect = canvas.getBoundingClientRect();
          // Calculate the center of the visible canvas area in world coordinates
          const canvasCenterScreen = { x: canvas.width / 2, y: canvas.height / 2 };
          const canvasCenterWorld = screenToWorld(canvasCenterScreen, canvas, camera);
    
          const ductType = categoryToDuctType[category] || DuctPartType.Straight;
    
          const newPart = {
            ...item,
            id: Date.now(),
            groupId: Date.now(),
            x: canvasCenterWorld.x, // Place at center X
            y: canvasCenterWorld.y, // Place at center Y
            rotation: 0,
            isSelected: false,
            isFlipped: false,
            type: ductType,
          };
    addObject(newPart as AnyDuctPart);
  }, [canvasRef, camera, addObject]);

  const handleDragOver = useCallback((e: DragEvent) => {
      e.preventDefault();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;















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

  }, [canvasRef, handleMouseDown, handleMouseUp, handleMouseMove, handleMouseLeave, handleWheel, handleDrop, handleDragOver, findBestSnap]);
};