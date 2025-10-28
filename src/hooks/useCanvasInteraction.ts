import { RefObject, useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useAtom } from 'jotai';
// findNearestConnector を削除し、getObjectAt, screenToWorld, worldToScreen のみインポート
import { getObjectAt, screenToWorld, worldToScreen } from '@/lib/canvas-utils';
// DuctPartType を追加インポート
import { AnyDuctPart, DuctPartType, Point, DragState, SnapResult, FittingItem, StraightDuct, SnapPoint } from '@/lib/types';
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
  saveStateAtom,
} from '@/lib/jotai-store';

const SNAP_DISTANCE = 50; // オリジナルに合わせる
const DRAG_SNAP_DISTANCE = 20; // オリジナルの定数を追加

// --- 新しい findSnapPoint 関数 (オリジナルのロジックを移植) ---
const findSnapPoint = (worldPos: Point, objects: AnyDuctPart[], camera: { zoom: number }): SnapPoint | null => {
    const snapDistSq = (DRAG_SNAP_DISTANCE / camera.zoom) ** 2;
    let candidates: { distSq: number; point: SnapPoint; objectType: DuctPartType }[] = [];

    // Find all potential snap points within range
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
                    point: {
                        x: p.x,
                        y: p.y,
                        objId: obj.id,
                        pointId: p.id,
                        pointType: p.type
                    },
                    objectType: obj.type // 優先度付けのためにオブジェクトタイプを保持
                });
            }
        }
    }

    if (candidates.length === 0) return null;

    // Sort candidates by distance
    candidates.sort((a, b) => a.distSq - b.distSq);

    const closestDistSq = candidates[0].distSq;

    // Filter for all candidates that are equally close (within a small tolerance)
    const closestCandidates = candidates.filter(c => c.distSq <= closestDistSq + 0.01);

    // From the closest candidates, prefer a fitting over a straight duct
    let bestCandidate = closestCandidates.find(c => c.objectType !== DuctPartType.Straight);

    // If no fitting is among the closest, just take the first one (which could be a straight duct)
    if (!bestCandidate) {
        bestCandidate = closestCandidates[0];
    }

    return bestCandidate.point;
};
// --- ここまで新しい findSnapPoint 関数 ---

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

  // 変数名を SNAP_DISTANCE から CONNECT_DISTANCE に変更し、値もオリジナルに合わせる
  const CONNECT_DISTANCE = 50;

  const findBestSnap = useCallback((draggedGroupId: number, currentObjects: AnyDuctPart[]) => {
    let bestSnap: SnapResult = { dist: Infinity, dx: 0, dy: 0, otherObj: null };
    // ここは接続時のスナップ距離なので CONNECT_DISTANCE を使う
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
                    // Check if diameters match for connection
                    if (draggedConnector.diameter === staticConnector.diameter) {
                        const dist = Math.hypot(draggedConnector.x - staticConnector.x, draggedConnector.y - staticConnector.y);
                        // Check distance against connection snap distance
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
    }

    return bestSnap.dist === Infinity ? null : bestSnap;
  }, [camera.zoom]); // CONNECT_DISTANCE は定数なので依存配列から削除

  const handleMouseDown = useCallback((e: MouseEvent) => {
    closeContextMenu();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);

    if (mode === 'measure') {
      // findNearestConnector を findSnapPoint に置き換え
      const snapPoint = findSnapPoint(worldPoint, objects, camera);
      if (snapPoint) {
        const newMeasurePoints = [...measurePoints, snapPoint];
        if (newMeasurePoints.length === 2) {
          // dimensionModalContentAtom に渡す形式が { p1, p2 } なので合わせる
          openDimensionModal({ p1: newMeasurePoints[0], p2: newMeasurePoints[1] });
          // 計測が終わったらポイントをクリア
          clearMeasurePoints();
          // DimensionModal が開いたら計測モードを終了させる（任意）
          // setMode('pan');
        } else {
          addMeasurePoint(snapPoint);
        }
      } else {
          // スナップポイントが見つからなくても、クリックした点を追加するなどの代替動作も可能
          // 現在はスナップしない場合は何もしない
      }
      return; // 計測モード時はオブジェクト選択やパンを行わない
    }

    // --- Pan/Drag ロジック (変更なし) ---
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
  }, [
      canvasRef, camera, objects, mode, measurePoints, selectObject,
      closeContextMenu, addMeasurePoint, clearMeasurePoints,
      openDimensionModal, setDragState, setIsPanning // setMode も依存配列に追加 (計測モード終了のため)
  ]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPoint = screenToWorld(screenPoint, canvas, camera);
    // マウス位置は常に更新
    setMouseWorldPos(worldPoint);

    // --- Drag ロジック (変更なし) ---
    if (dragState.isDragging && dragState.targetId && dragState.initialPositions) {
      closeContextMenu(); // ドラッグ中はコンテキストメニューを閉じる

      const initialTargetPos = dragState.initialPositions.get(dragState.targetId);
      if (!initialTargetPos) return;

      const total_dx = (worldPoint.x - dragState.offset.x) - initialTargetPos.x;
      const total_dy = (worldPoint.y - dragState.offset.y) - initialTargetPos.y;

      // Update positions based on initial positions + total delta
      setObjects(prev => prev.map(o => {
        if (dragState.initialPositions!.has(o.id)) {
          const initialPos = dragState.initialPositions!.get(o.id)!;
          return { ...o, x: initialPos.x + total_dx, y: initialPos.y + total_dy };
        }
        return o;
      }));

      // ドラッグ中は return してパンさせない
      return;
    }

    // --- Pan ロジック (変更なし) ---
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setCamera({ x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }

    // メジャーモードでなくても、マウス位置のスナップ表示はここで行う場合がある
    // (useCanvas フック側で currentSnapPointAtom を見て描画するなど)
    // if (mode === 'measure') {
    //   const snapPoint = findSnapPoint(worldPoint, objects, camera);
    //   setCurrentSnapPoint(snapPoint); // Jotai atom に現在のスナップポイントを保存
    // }

  }, [
      canvasRef, camera, setMouseWorldPos, closeContextMenu, setObjects,
      setCamera, dragState, isPanning // setCurrentSnapPoint も依存配列に追加
  ]);

  // --- handleMouseUp, handleMouseLeave, handleWheel, handleDrop, handleDragOver (大きな変更なし) ---
  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let wasDragging = false;
    // --- ドラッグ終了処理 ---
    if (dragState.isDragging && dragState.targetId) {
        wasDragging = true;
        // マウスアップ時のオブジェクトの状態 (ドラッグ中に更新されている可能性がある)
        const currentObjects = objects; // jotai の useAtomValue は最新を返すはず
        const draggedObj = currentObjects.find(o => o.id === dragState.targetId);

        if (draggedObj) {
            const snap = findBestSnap(draggedObj.groupId, currentObjects);
            let connectionMade = false;
            let finalObjects = currentObjects; // スナップ適用前の状態

            // --- スナップ接続処理 ---
            if (snap && snap.otherObj) {
                connectionMade = true;
                const draggedGroupId = draggedObj.groupId;
                const groupToMergeId = snap.otherObj.groupId;

                // スナップの差分だけ移動させて結合
                finalObjects = currentObjects.map(o => {
                    let newObj = { ...o };
                    // ドラッグされたグループ全体を移動
                    if (o.groupId === draggedGroupId) {
                        newObj.x += snap.dx;
                        newObj.y += snap.dy;
                    }
                    // 接続先のグループIDをドラッグされたグループIDに統一
                    if (newObj.groupId === groupToMergeId) {
                        newObj.groupId = draggedGroupId;
                    }
                    return newObj;
                });
                // 更新されたオブジェクト配列をJotaiにセット
                setObjects(finalObjects);
            }

            // --- 状態保存の判定 ---
            const initialPos = dragState.initialPositions?.get(dragState.targetId);
            // finalObjects (スナップ適用後の可能性あり) から最終位置を取得
            const finalTargetObj = finalObjects.find(o => o.id === dragState.targetId);
            // 初期位置と最終位置を比較
            const posChanged = finalTargetObj && initialPos && (finalTargetObj.x !== initialPos.x || finalTargetObj.y !== initialPos.y);

            // 位置が変わったか、接続が行われた場合に履歴を保存
            if (posChanged || connectionMade) {
                saveState();
            }

            // --- コンテキストメニュー表示 ---
            // 接続されなかった場合でも、ドラッグされたオブジェクトの位置で表示
            if (finalTargetObj) {
                // スナップ適用後のオブジェクト位置を使う
                const objectScreenPos = worldToScreen({ x: finalTargetObj.x, y: finalTargetObj.y }, canvas, camera);
                // メニューがオブジェクトに重ならないように少し上に表示
                openContextMenu({ x: objectScreenPos.x, y: objectScreenPos.y - 50 });
            }
        }
    }

    // --- パン/ドラッグ状態のリセット ---
    if (isPanning || wasDragging) {
        setIsPanning(false);
        setDragState({ isDragging: false, targetId: null, initialPositions: null, offset: { x: 0, y: 0 } });
        canvas.style.cursor = 'grab'; // カーソルを通常に戻す
    } else {
        // ドラッグもパンもしていないクリックアップの場合（オブジェクト選択解除など）
        // 必要ならここでオブジェクト選択解除などを行う
        // selectObject(null); // 例: 何もないところをクリックしたら選択解除
    }
  }, [
      camera, objects, dragState, isPanning, findBestSnap, setObjects,
      saveState, openContextMenu, worldToScreen, canvasRef,
      setIsPanning, setDragState // selectObject も依存配列に追加
  ]);

  const handleMouseLeave = useCallback(() => {
      setMouseWorldPos(null);
      // Also end panning/dragging if mouse leaves canvas
      if (isPanning || dragState.isDragging) {
        handleMouseUp();
      }
  }, [setMouseWorldPos, isPanning, dragState.isDragging, handleMouseUp]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    closeContextMenu(); // ズーム中はメニューを閉じる
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.exp(delta * zoomIntensity);

    // Get mouse position in world coordinates before zoom
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const worldPosBeforeZoom = screenToWorld(screenPoint, canvas, camera);

    // Calculate new zoom level
    const newZoom = Math.max(0.1, Math.min(camera.zoom * zoomFactor, 10));

    // Calculate new camera position to keep mouse position fixed in world space
    const newCameraX = worldPosBeforeZoom.x - (screenPoint.x - rect.width / 2) / newZoom + rect.width / 2;
    const newCameraY = worldPosBeforeZoom.y - (screenPoint.y - rect.height / 2) / newZoom + rect.height / 2;

    setCamera({ zoom: newZoom, x: newCameraX, y: newCameraY });
  }, [camera, closeContextMenu, setCamera, canvasRef]); // canvasRef を依存配列に追加

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const itemJson = e.dataTransfer?.getData('application/json');
    if (!itemJson) return;

    try {
        const item = JSON.parse(itemJson) as FittingItem;
        const rect = canvas.getBoundingClientRect();
        const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const worldPoint = screenToWorld(screenPoint, canvas, camera);

        // Get system name and diameter from inputs if they exist
        const systemNameInput = document.getElementById('system-name') as HTMLInputElement | null;
        const diameterInput = document.getElementById('custom-diameter') as HTMLInputElement | null; // Note: This might not be relevant for fittings
        const systemName = systemNameInput?.value || 'SYS'; // Default system name
        const defaultDiameter = diameterInput ? parseInt(diameterInput.value, 10) : 100; // Default if input not found or invalid

        // Create the base part structure
        let newPart: Partial<AnyDuctPart> & { id: number, groupId: number, x: number, y: number, type: DuctPartType } = {
          id: Date.now(),
          groupId: Date.now(),
          x: worldPoint.x,
          y: worldPoint.y,
          rotation: 0,
          isSelected: false,
          isFlipped: false,
          systemName: systemName,
          name: item.name || 'Unnamed',
          type: item.type,
          diameter: item.diameter || defaultDiameter, // Use item diameter or default
        };

        // Add type-specific properties from the FittingItem
        // Use type assertion carefully or check properties exist
        switch (item.type) {
            case DuctPartType.Straight: // Should ideally not be dropped, but handle just in case
                (newPart as StraightDuct).length = item.length || 400; // Default length
                break;
            case DuctPartType.Damper:
                 (newPart as any).length = item.length || 100;
                 break;
            case DuctPartType.Elbow90:
                (newPart as any).legLength = item.legLength;
                break;
            case DuctPartType.AdjustableElbow:
                (newPart as any).legLength = item.legLength;
                (newPart as any).angle = item.angle;
                break;
            case DuctPartType.TeeReducer:
                (newPart as any).length = item.length;
                (newPart as any).branchLength = item.branchLength;
                (newPart as any).diameter2 = item.diameter2;
                (newPart as any).diameter3 = item.diameter3;
                (newPart as any).intersectionOffset = item.intersectionOffset;
                break;
            case DuctPartType.YBranch: // Assuming YBranch might exist or be added later
                (newPart as any).length = item.length;
                (newPart as any).angle = item.angle;
                (newPart as any).branchLength = item.branchLength;
                (newPart as any).intersectionOffset = item.intersectionOffset;
                 // YBranch might not have diameter2/3, handle appropriately if needed
                 break;
            case DuctPartType.YBranchReducer:
                (newPart as any).length = item.length;
                (newPart as any).angle = item.angle;
                (newPart as any).branchLength = item.branchLength;
                (newPart as any).intersectionOffset = item.intersectionOffset;
                (newPart as any).diameter2 = item.diameter2;
                (newPart as any).diameter3 = item.diameter3;
                break;
            case DuctPartType.Reducer:
                (newPart as any).length = item.length;
                (newPart as any).diameter2 = item.diameter2;
                break;
            default:
                console.warn("Dropped unknown or unhandled part type:", item.type);
                return; // Don't add unknown types
        }

        // Add the fully constructed part
        addObject(newPart as AnyDuctPart); // Assert type after adding all properties
        saveState(); // Save state after adding

    } catch (error) {
        console.error("Failed to parse dropped item data:", error);
    }
  }, [canvasRef, camera, addObject, saveState]); // saveState を依存配列に追加

  const handleDragOver = useCallback((e: DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy'; // Indicate copying
      }
  }, []);

  // --- Event Listener Setup (変更なし) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false }); // Keep passive false for wheel zoom
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);

    // Cleanup function
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

  // --- Pending Action (Add Straight Duct) Logic (変更なし) ---
  const [pendingAction, setPendingAction] = useAtom(pendingActionAtom);

  useEffect(() => {
    if (pendingAction === 'add-straight-duct-at-center') {
      const canvas = canvasRef.current;
      if (!canvas) {
          setPendingAction(null); // Clear action if canvas is not ready
          return;
      }

      const rect = canvas.getBoundingClientRect();
      const canvasCenterScreen = { x: rect.width / 2, y: rect.height / 2 };
      const worldCenter = screenToWorld(canvasCenterScreen, canvas, camera);

      // Get system name and diameter from inputs
      const systemNameInput = document.getElementById('system-name') as HTMLInputElement | null;
      const diameterInput = document.getElementById('custom-diameter') as HTMLInputElement | null;
      const systemName = systemNameInput?.value || 'SYS'; // Default if input not found
      const diameter = diameterInput ? parseInt(diameterInput.value, 10) : 100; // Default if input not found or invalid

      // Create the new straight duct object
      const newDuct: StraightDuct = {
        id: Date.now(), // Use timestamp for unique ID
        groupId: Date.now(), // Each new object starts in its own group
        type: DuctPartType.Straight,
        x: worldCenter.x,
        y: worldCenter.y,
        length: 400, // Default length
        diameter: diameter, // Use diameter from input
        name: `直管 D${diameter}`, // Auto-generate name based on diameter
        rotation: 0,
        systemName: systemName, // Use system name from input
        isSelected: false,
        isFlipped: false,
      };

      // Add the object and save state
      addObject(newDuct);
      saveState(); // Save state after adding the duct
      setPendingAction(null); // Clear the pending action
    }
  }, [pendingAction, canvasRef, camera, addObject, setPendingAction, saveState]); // saveState を依存配列に追加
};