import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
import { getObjectAt, screenToWorld, worldToScreen } from '@/lib/canvas-utils';
import { AnyDuctPart, DuctPartType, Point, DragState, SnapResult, FittingItem, StraightDuct, SnapPoint, Connector, IntersectionPoint } from '@/lib/types';
import { createDuctPart, DuctPart } from '@/lib/duct-models';
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
  saveStateAtom,
} from '@/lib/jotai-store';

const DRAG_SNAP_DISTANCE = 20; 
const CONNECT_DISTANCE = 50; 

// findSnapPoint (変更なし)
const findSnapPoint = (worldPos: Point, objects: AnyDuctPart[], camera: { zoom: number }): SnapPoint | null => {
    const snapDistSq = (DRAG_SNAP_DISTANCE / camera.zoom) ** 2;
    let candidates: { distSq: number; point: SnapPoint; objectType: DuctPartType }[] = [];
    for (const obj of objects) {
        const model = createDuctPart(obj);
        if (!model) continue;
        const points = [
            ...model.getConnectors().map(p => ({ ...p, type: 'connector' as const })),
            ...model.getIntersectionPoints().map(p => ({ ...p, type: 'intersection' as const }))
        ];
        for (const p of points) {
            const distSq = (worldPos.x - p.x) ** 2 + (worldPos.y - p.y) ** 2;
            if (distSq < snapDistSq) {
                candidates.push({
                    distSq: distSq,
                    point: { x: p.x, y: p.y, objId: obj.id, pointId: p.id, pointType: p.type },
                    objectType: obj.type
                });
            }
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.distSq - b.distSq);
    const closestDistSq = candidates[0].distSq;
    const closestCandidates = candidates.filter(c => c.distSq <= closestDistSq + 0.01);
    let bestCandidate = closestCandidates.find(c => c.objectType !== DuctPartType.Straight);
    if (!bestCandidate) { bestCandidate = closestCandidates[0]; }
    return bestCandidate.point;
};

// ★★★ 修正点 1: オリジナルの `getLegLength` を `getLegLengthFromConnector` として正確に移植 ★★★
// この関数は、特定の「コネクタ」情報(id: 0, 1, 2)に基づいて脚長を返します。
function getLegLengthFromConnector(objData: AnyDuctPart | null, conn: Connector | null): number {
    if (!objData || !conn) return 0;
    const model = createDuctPart(objData);
    if (!model) return 0;
    
    switch(model.type) {
        case DuctPartType.Elbow90:
        case DuctPartType.AdjustableElbow:
            if ('legLength' in model) return model.legLength as number;
            break;
        case DuctPartType.TeeReducer:
             if ('branchLength' in model && conn.type === 'branch') return model.branchLength as number;
             if ('length' in model && 'intersectionOffset' in model) {
                 if (conn.id === 0) return (model.length as number) / 2 + (model.intersectionOffset as number);
                 if (conn.id === 1) return (model.length as number) / 2 - (model.intersectionOffset as number);
             }
             break;
        case DuctPartType.YBranch:
        case DuctPartType.YBranchReducer:
             if ('branchLength' in model && conn.type === 'branch') return model.branchLength as number;
             if ('length' in model && 'intersectionOffset' in model) {
                 if (conn.id === 0) return (model.length as number) / 2 + (model.intersectionOffset as number);
                 if (conn.id === 1) return (model.length as number) / 2 - (model.intersectionOffset as number);
             }
             break;
    }
    return 0;
}

// ★★★ 修正点 2: オリジナルの `getConnectedLegLength` を移植 ★★★
// この関数は、フィッティング(継手)とダクト(直管)を受け取り、
// それらが接続されているコネクタを見つけ出し、その脚長を返します。
const getConnectedLegLength = (fittingData: AnyDuctPart | null, ductData: AnyDuctPart | null): number => {
    if (!fittingData || !ductData || fittingData.type === DuctPartType.Straight) return 0;

    const ductModel = createDuctPart(ductData);
    const fittingModel = createDuctPart(fittingData);
    if (!ductModel || !fittingModel) return 0;

    const ductConns = ductModel.getConnectors();
    const fittingConns = fittingModel.getConnectors();
    let relevantConn: Connector | null = null;

    for (const fc of fittingConns) {
        // フィッティングのコネクタ(fc)が、ダクトのいずれかのコネクタ(dc)と接続(座標一致)しているか
        if (ductConns.some(dc => Math.hypot(fc.x - dc.x, fc.y - dc.y) < 1)) {
            relevantConn = fc;
            break;
        }
    }
    
    // 見つかった接続コネクタ情報(relevantConn)を使って、脚長を取得
    return getLegLengthFromConnector(fittingData, relevantConn);
};


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
  const saveState = useSetAtom(saveStateAtom);

  const [isPanning, setIsPanning] = useAtom(isPanningAtom);
  const [dragState, setDragState] = useAtom(dragStateAtom);
  const lastMousePos = useRef<Point>({ x: 0, y: 0 });

  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDist = useRef<number>(0);
  const lastPinchMidpoint = useRef<Point | null>(null); 

  // findBestSnap (変更なし)
  const findBestSnap = useCallback((draggedGroupId: number, currentObjects: AnyDuctPart[]) => {
    let bestSnap: SnapResult = { dist: Infinity, dx: 0, dy: 0, otherObj: null };
    const snapDist = CONNECT_DISTANCE / camera.zoom;
    const draggedObjects = currentObjects.filter(o => o.groupId === draggedGroupId);
    for (const draggedObj of draggedObjects) {
        const draggedModel = createDuctPart(draggedObj);
        if (!draggedModel) continue;
        for (const draggedConnector of draggedModel.getConnectors()) {
            for (const staticObj of currentObjects) {
                if (staticObj.groupId === draggedGroupId) continue;
                const staticModel = createDuctPart(staticObj);
                if (!staticModel) continue;
                for (const staticConnector of staticModel.getConnectors()) {
                    if (draggedConnector.diameter === staticConnector.diameter) {
                        const dist = Math.hypot(draggedConnector.x - staticConnector.x, draggedConnector.y - staticConnector.y);
                        if (dist < snapDist && dist < bestSnap.dist) {
                          bestSnap = { dist, dx: staticConnector.x - draggedConnector.x, dy: staticConnector.y - draggedConnector.y, otherObj: staticObj };
                        }
                    }
                }
            }
        }
    }
    return bestSnap.dist === Infinity ? null : bestSnap;
  }, [camera.zoom]);

  // ★★★ 修正点 3: processMeasurement が正しいヘルパー関数を使うように修正 ★★★
  const processMeasurement = useCallback((p1_info: SnapPoint, p2_info: SnapPoint) => {
      const measuredDistance = Math.hypot(p2_info.x - p1_info.x, p2_info.y - p1_info.y);
      
      // (findEndpointObject ヘルパーはオリジナル と同じロジックで正しい)
      const findEndpointObject = (pointInfo: SnapPoint): AnyDuctPart | null => {
          const clickedObj = objects.find(o => o.id === pointInfo.objId);
          if (!clickedObj) return null;
          if (pointInfo.pointType === 'intersection') return clickedObj;
          const connectedFitting = objects.find(o =>
              o.id !== clickedObj.id && o.groupId === clickedObj.groupId && o.type !== DuctPartType.Straight &&
              createDuctPart(o)?.getConnectors().some(c => Math.hypot(c.x - pointInfo.x, c.y - pointInfo.y) < 1)
          );
          return connectedFitting || clickedObj;
      };
      const obj1 = findEndpointObject(p1_info);
      const obj2 = findEndpointObject(p2_info);

      if (!obj1 || !obj2) {
          console.error("Could not find objects for measurement points:", p1_info, p2_info);
          clearMeasurePoints();
          return;
      }

      let ductToUpdate: AnyDuctPart | null = null;
      let lengthToSubtract = 0;
      
      // (直管探索ロジックもオリジナル と同じで正しい)
      if (obj1 && obj2 && obj1.groupId === obj2.groupId) {
          if (obj1.type === DuctPartType.Straight && obj1.id === obj2.id) { ductToUpdate = obj1; }
          else {
              const straightDuctsInGroup = objects.filter(o => o.groupId === obj1.groupId && o.type === DuctPartType.Straight);
              for (const duct of straightDuctsInGroup) {
                  const ductModel = createDuctPart(duct); if (!ductModel) continue;
                  const conns = ductModel.getConnectors();
                  const model1 = createDuctPart(obj1)!;
                  const model2 = createDuctPart(obj2)!;
                  const connectsTo1 = conns.some(c1 => model1.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1));
                  const connectsTo2 = conns.some(c1 => model2.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1));
                  if (connectsTo1 && connectsTo2) { ductToUpdate = duct; break; }
              }
          }
      }
      
      // (ロジック修正箇所)
      if (ductToUpdate) {
          const isP1Intersection = p1_info.pointType === 'intersection';
          const isP2Intersection = p2_info.pointType === 'intersection';
          
          // (オリジナル と同じロジックに修正)
          // 継手(obj1) と 直管(ductToUpdate) を渡して、接続されている脚長を取得
          const contribution1 = isP1Intersection ? getConnectedLegLength(obj1, ductToUpdate) : 0;
          const contribution2 = isP2Intersection ? getConnectedLegLength(obj2, ductToUpdate) : 0;
          
          lengthToSubtract = contribution1 + contribution2;
      }
      
      // (モーダル呼び出しは変更なし)
      openDimensionModal({ p1: p1_info, p2: p2_info, measuredDistance: measuredDistance, ductToUpdateId: ductToUpdate ? ductToUpdate.id : undefined, lengthToSubtract: ductToUpdate ? lengthToSubtract : undefined });
      clearMeasurePoints();
  }, [objects, openDimensionModal, clearMeasurePoints]);


  // (handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleWheel は変更なし - 前回の修正を維持)
  // ...
  const handleMouseDown = useCallback((e: MouseEvent) => {
    closeContextMenu();
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);
    if (mode === 'measure') {
      const snapPoint = findSnapPoint(worldPoint, objects, camera);
      if (snapPoint) {
        const newMeasurePoints = [...measurePoints, snapPoint];
        if (newMeasurePoints.length === 2) { processMeasurement(newMeasurePoints[0], newMeasurePoints[1]); }
        else { addMeasurePoint(snapPoint); }
      } return;
    }
    const clickedObject = getObjectAt(worldPoint, objects);
    selectObject(clickedObject ? clickedObject.id : null);
    if (clickedObject) {
      const initialPositions = new Map<number, Point>();
      objects.forEach(obj => { if (obj.groupId === clickedObject.groupId) { initialPositions.set(obj.id, { x: obj.x, y: obj.y }); } });
      setDragState({ isDragging: true, targetId: clickedObject.id, initialPositions, offset: { x: worldPoint.x - clickedObject.x, y: worldPoint.y - clickedObject.y } });
      canvas.style.cursor = 'grabbing';
    } else {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    }
  }, [ canvasRef, camera, objects, mode, measurePoints, selectObject, closeContextMenu, addMeasurePoint, setDragState, setIsPanning, processMeasurement ]);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);
    setMouseWorldPos(worldPoint);
    
    if (dragState.isDragging && dragState.targetId && dragState.initialPositions) {
      closeContextMenu();
      const initialTargetPos = dragState.initialPositions.get(dragState.targetId); if (!initialTargetPos) return;
      const total_dx = (worldPoint.x - dragState.offset.x) - initialTargetPos.x;
      const total_dy = (worldPoint.y - dragState.offset.y) - initialTargetPos.y;
      setObjects(prev => prev.map(o => {
        if (dragState.initialPositions!.has(o.id)) {
          const initialPos = dragState.initialPositions!.get(o.id)!;
          return { ...o, x: initialPos.x + total_dx, y: initialPos.y + total_dy };
        } return o;
      })); return;
    }
    
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setCamera({ x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom }); 
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [ canvasRef, camera, setMouseWorldPos, closeContextMenu, setObjects, setCamera, dragState, isPanning ]);
  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let wasDragging = false;
    if (dragState.isDragging && dragState.targetId) {
        wasDragging = true;
        const currentObjects = objects; 
        const draggedObj = currentObjects.find(o => o.id === dragState.targetId);
        if (draggedObj) {
            const snap = findBestSnap(draggedObj.groupId, currentObjects);
            let connectionMade = false; let finalObjects = currentObjects;
            if (snap && snap.otherObj) {
                connectionMade = true; const draggedGroupId = draggedObj.groupId; const groupToMergeId = snap.otherObj.groupId;
                finalObjects = currentObjects.map(o => {
                    let newObj = { ...o };
                    if (o.groupId === draggedGroupId) { newObj.x += snap.dx; newObj.y += snap.dy; }
                    if (newObj.groupId === groupToMergeId) { newObj.groupId = draggedGroupId; }
                    return newObj;
                }); setObjects(finalObjects);
            }
            const initialPos = dragState.initialPositions?.get(dragState.targetId);
            const finalTargetObj = finalObjects.find(o => o.id === dragState.targetId);
            const posChanged = finalTargetObj && initialPos && (finalTargetObj.x !== initialPos.x || finalTargetObj.y !== initialPos.y);
            if (posChanged || connectionMade) { saveState(); }
            if (finalTargetObj) {
                const objectScreenPos = worldToScreen({ x: finalTargetObj.x, y: finalTargetObj.y }, canvas, camera);
                openContextMenu({ x: objectScreenPos.x, y: objectScreenPos.y - 50 });
            }
        }
    }
    if (isPanning || wasDragging) {
        setIsPanning(false);
        setDragState({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
        canvas.style.cursor = 'grab';
    }
  }, [ camera, objects, dragState, isPanning, findBestSnap, setObjects, saveState, openContextMenu, worldToScreen, canvasRef, setIsPanning, setDragState ]); 
  const handleMouseLeave = useCallback(() => {
      setMouseWorldPos(null);
      if (isPanning || dragState.isDragging) { handleMouseUp(); }
  }, [setMouseWorldPos, isPanning, dragState.isDragging, handleMouseUp]);
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    closeContextMenu();
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.exp(delta * zoomIntensity);
    const newZoom = Math.max(0.1, Math.min(camera.zoom * zoomFactor, 10));
    setCamera({ zoom: newZoom }); 
  }, [camera, closeContextMenu, setCamera, canvasRef]);
  const handleTouchStart = useCallback((e: TouchEvent) => {
      e.preventDefault(); closeContextMenu();
      const canvas = canvasRef.current; if (!canvas) return;
      const touches = e.touches;
      if (touches.length === 2) {
          setIsPinching(true); setIsPanning(false); setDragState(prev => ({ ...prev, isDragging: false }));
          const t1 = touches[0]; const t2 = touches[1];
          initialPinchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const rect = canvas.getBoundingClientRect();
          lastPinchMidpoint.current = { x: (t1.clientX + t2.clientX) / 2 - rect.left, y: (t1.clientY + t2.clientY) / 2 - rect.top };
          canvas.style.cursor = 'move';
      } else if (touches.length === 1 && !isPinching) {
          const touch = touches[0]; const rect = canvas.getBoundingClientRect();
          const screenPoint = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
          const worldPoint = screenToWorld(screenPoint, canvas, camera);
          if (mode === 'measure') {
              const snapPoint = findSnapPoint(worldPoint, objects, camera);
              if (snapPoint) {
                  const newMeasurePoints = [...measurePoints, snapPoint];
                  if (newMeasurePoints.length === 2) { processMeasurement(newMeasurePoints[0], newMeasurePoints[1]); }
                  else { addMeasurePoint(snapPoint); }
              } return;
          }
          const clickedObject = getObjectAt(worldPoint, objects);
          selectObject(clickedObject ? clickedObject.id : null);
          if (clickedObject) {
              const initialPositions = new Map<number, Point>();
              objects.forEach(obj => { if (obj.groupId === clickedObject.groupId) { initialPositions.set(obj.id, { x: obj.x, y: obj.y }); } });
              setDragState({ isDragging: true, targetId: clickedObject.id, initialPositions, offset: { x: worldPoint.x - clickedObject.x, y: worldPoint.y - clickedObject.y } });
              canvas.style.cursor = 'grabbing';
          } else {
              setIsPanning(true); lastMousePos.current = { x: touch.clientX, y: touch.clientY }; canvas.style.cursor = 'grabbing';
          }
      }
  }, [canvasRef, camera, objects, mode, measurePoints, isPinching, selectObject, closeContextMenu, addMeasurePoint, setDragState, setIsPanning, processMeasurement]);
  const handleTouchMove = useCallback((e: TouchEvent) => {
      e.preventDefault(); const canvas = canvasRef.current; if (!canvas) return;
      const touches = e.touches; const rect = canvas.getBoundingClientRect();
      
      if (touches.length === 2 && isPinching) {
          const t1 = touches[0]; const t2 = touches[1];
          const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const midpointScreen = { x: (t1.clientX + t2.clientX) / 2 - rect.left, y: (t1.clientY + t2.clientY) / 2 - rect.top };
          
          if (initialPinchDist.current > 0) {
              const zoomFactor = newDist / initialPinchDist.current;
              const newZoomUncapped = camera.zoom * zoomFactor;
              const newZoom = Math.max(0.1, Math.min(newZoomUncapped, 10));
              
              let panDX = 0;
              let panDY = 0;
              if (lastPinchMidpoint.current) {
                  panDX = (midpointScreen.x - lastPinchMidpoint.current.x);
                  panDY = (midpointScreen.y - lastPinchMidpoint.current.y);
              }
              
              setCamera({ zoom: newZoom, x: camera.x + panDX / newZoom, y: camera.y + panDY / newZoom }); 
          }
          initialPinchDist.current = newDist; lastPinchMidpoint.current = midpointScreen;

      } else if (touches.length === 1 && !isPinching) {
          const touch = touches[0]; const screenPoint = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
          const worldPoint = screenToWorld(screenPoint, canvas, camera); setMouseWorldPos(worldPoint);
          
          if (dragState.isDragging && dragState.targetId && dragState.initialPositions) {
              closeContextMenu(); const initialTargetPos = dragState.initialPositions.get(dragState.targetId); if (!initialTargetPos) return;
              const total_dx = (worldPoint.x - dragState.offset.x) - initialTargetPos.x; const total_dy = (worldPoint.y - dragState.offset.y) - initialTargetPos.y;
              setObjects(prev => prev.map(o => {
                  if (dragState.initialPositions!.has(o.id)) { const initialPos = dragState.initialPositions!.get(o.id)!; return { ...o, x: initialPos.x + total_dx, y: initialPos.y + total_dy }; } return o;
              })); return;
          }
          
          if (isPanning) {
              const dx = touch.clientX - lastMousePos.current.x;
              const dy = touch.clientY - lastMousePos.current.y;
              setCamera({ x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom }); 
              lastMousePos.current = { x: touch.clientX, y: touch.clientY };
          }
      }
  }, [canvasRef, camera, isPinching, dragState, isPanning, closeContextMenu, setObjects, setCamera, setMouseWorldPos]);
  const handleTouchEnd = useCallback((e: TouchEvent) => {
      const canvas = canvasRef.current; if (!canvas) return;
      if (isPinching) {
          if (e.touches.length < 2) {
              setIsPinching(false);
              initialPinchDist.current = 0;
              lastPinchMidpoint.current = null;
              canvas.style.cursor = 'grab';
          }
          return; 
      }
      const wasDragging = dragState.isDragging && dragState.targetId;
      const wasPanning = isPanning;
      if (wasDragging) {
          handleMouseUp(); 
      } else if (wasPanning) {
          setIsPanning(false);
          setDragState({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
          canvas.style.cursor = 'grab';
      } else {
          setDragState({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
          canvas.style.cursor = 'grab';
      }
  }, [isPinching, dragState, isPanning, handleMouseUp, setIsPanning, setDragState, canvasRef]);
// ...

  // (handleDrop, handleDragOver, useEffect[Event Listeners] は変更なし)
  // ...
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); const canvas = canvasRef.current; if (!canvas) return;
    const itemJson = e.dataTransfer?.getData('application/json'); if (!itemJson) return;
    try {
        const item = JSON.parse(itemJson) as FittingItem;
        const rect = canvas.getBoundingClientRect(); const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top }; const worldPoint = screenToWorld(screenPoint, canvas, camera);
        const systemNameInput = document.getElementById('system-name') as HTMLInputElement | null; const diameterInput = document.getElementById('custom-diameter') as HTMLInputElement | null;
        const systemName = systemNameInput?.value || 'SYS'; const defaultDiameter = diameterInput ? parseInt(diameterInput.value, 10) : 100;
        let newPart: Partial<AnyDuctPart> & { id: number, groupId: number, x: number, y: number, type: DuctPartType } = {
          id: Date.now(), groupId: Date.now(), x: worldPoint.x, y: worldPoint.y, rotation: 0, isSelected: false, isFlipped: false, systemName: systemName, name: item.name || 'Unnamed', type: item.type, diameter: item.diameter || defaultDiameter,
        };
        switch (item.type) {
            case DuctPartType.Straight: (newPart as StraightDuct).length = item.length || 400; break;
            case DuctPartType.Damper: (newPart as any).length = item.length || 100; break;
            case DuctPartType.Elbow90: (newPart as any).legLength = item.legLength; break;
            case DuctPartType.AdjustableElbow: (newPart as any).legLength = item.legLength; (newPart as any).angle = item.angle; break;
            case DuctPartType.TeeReducer: (newPart as any).length = item.length; (newPart as any).branchLength = item.branchLength; (newPart as any).diameter2 = item.diameter2; (newPart as any).diameter3 = item.diameter3; (newPart as any).intersectionOffset = item.intersectionOffset; break;
            case DuctPartType.YBranch: (newPart as any).length = item.length; (newPart as any).angle = item.angle; (newPart as any).branchLength = item.branchLength; (newPart as any).intersectionOffset = item.intersectionOffset; break;
            case DuctPartType.YBranchReducer: (newPart as any).length = item.length; (newPart as any).angle = item.angle; (newPart as any).branchLength = item.branchLength; (newPart as any).intersectionOffset = item.intersectionOffset; (newPart as any).diameter2 = item.diameter2; (newPart as any).diameter3 = item.diameter3; break;
            case DuctPartType.Reducer: (newPart as any).length = item.length; (newPart as any).diameter2 = item.diameter2; break;
            default: console.warn("Dropped unknown type:", item.type); return;
        }
        addObject(newPart as AnyDuctPart);
        saveState();
    } catch (error) { console.error("Drop failed:", error); }
  }, [canvasRef, camera, addObject, saveState]);
  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); if (e.dataTransfer) { e.dataTransfer.dropEffect = 'copy'; } }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [canvasRef, handleMouseDown, handleMouseUp, handleMouseMove, handleMouseLeave, handleWheel, handleDrop, handleDragOver, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // (pendingAction の length: 200 修正を維持)
  const [pendingAction, setPendingAction] = useAtom(pendingActionAtom);
  useEffect(() => {
    if (pendingAction === 'add-straight-duct-at-center') {
      const canvas = canvasRef.current; if (!canvas) { setPendingAction(null); return; }
      const rect = canvas.getBoundingClientRect(); const canvasCenterScreen = { x: rect.width / 2, y: rect.height / 2 }; const worldCenter = screenToWorld(canvasCenterScreen, canvas, camera);
      const systemNameInput = document.getElementById('system-name') as HTMLInputElement | null; const diameterInput = document.getElementById('custom-diameter') as HTMLInputElement | null;
      const systemName = systemNameInput?.value || 'SYS'; const diameter = diameterInput ? parseInt(diameterInput.value, 10) : 100;
      
      const newDuct: StraightDuct = { 
          id: Date.now(), 
          groupId: Date.now(), 
          type: DuctPartType.Straight, 
          x: worldCenter.x, 
          y: worldCenter.y, 
          length: 200, 
          diameter: diameter, 
          name: `直管 D${diameter}`, 
          rotation: 0, 
          systemName: systemName, 
          isSelected: false, 
          isFlipped: false 
      };
      addObject(newDuct); saveState(); setPendingAction(null);
    }
  }, [pendingAction, canvasRef, camera, addObject, setPendingAction, saveState]);
};