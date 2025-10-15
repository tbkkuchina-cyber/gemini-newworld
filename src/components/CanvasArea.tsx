'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { DuctPart, DimensionLine } from '@/lib/objects';
import { PaletteItemData, SnapPoint, Point } from '@/lib/types';
import ContextMenu from '@/components/ContextMenu';

const CONNECT_DISTANCE = 50;
const SNAP_DISTANCE = 20;

const DimensionModal = ({ dimension, onApply, onCancel }: { dimension: {p1: Point, p2: Point}, onApply: (newLength: number) => void, onCancel: () => void }) => {
    const initialValue = Math.hypot(dimension.p2.x - dimension.p1.x, dimension.p2.y - dimension.p1.y);
    const [value, setValue] = useState(initialValue.toFixed(1));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // モーダルが表示されたとき (dimensionがnullでないとき) に実行
        if (dimension && inputRef.current) {
            // DOMが完全にレンダリングされるのを待つために短い遅延を入れる
            const timer = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50); // 50msの遅延
            return () => clearTimeout(timer);
        }
    }, [dimension]); // dimensionオブジェクトの変更を監視

    const handleApply = () => {
        const newLength = parseFloat(value);
        if (!isNaN(newLength) && newLength > 0) {
            onApply(newLength);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 space-y-4">
                <h3 className="text-lg font-bold">寸法を入力</h3>
                <input 
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">キャンセル</button>
                    <button onClick={handleApply} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">適用</button>
                </div>
            </div>
        </div>
    );
};


const CanvasArea = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    objects,
    dimensions,
    camera,
    panCamera,
    zoomCamera,
    selectObject,
    selectedObjectId,
    updateObjectPosition,
    addObject,
    applyDimensionAdjustment,
    saveHistory,
    mergeGroups,
    mode,
    rotateSelectedObject,
    deleteObject,
    undo,
    redo,
    updateStraightRunDimensions,
    screenshotTrigger, // ★ 追加
  } = useAppStore();

  const [interactionMode, setInteractionMode] = useState<'idle' | 'pan' | 'drag' | 'pinch'>('idle');
  const dragInfo = useRef({
    target: null as DuctPart | null,
    group: [] as { obj: DuctPart, initialX: number, initialY: number }[],
    worldStartX: 0,
    worldStartY: 0,
    hasDragged: false,
  });

  const panStart = useRef({ x: 0, y: 0 });
  const pinchState = useRef({ initialDist: 0 });
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastWorldMousePos = useRef({ x: 0, y: 0 });

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const [measureStartPoint, setMeasureStartPoint] = useState<SnapPoint | null>(null);
  const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(null);
  const [editingDimension, setEditingDimension] = useState<{p1: SnapPoint, p2: SnapPoint} | null>(null);

  const getPointForDim = useCallback((objects: DuctPart[], objectId: number, pointType: 'connector' | 'intersection', pointId: string | number): Point | null => {
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return null;
    const points = pointType === 'connector' ? obj.getConnectors() : obj.getIntersectionPoints();
    const point = points.find(p => p.id === pointId);
    return point ? { x: point.x, y: point.y } : null;
  }, []);

  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    const canvas = canvasRef.current!;
    const screenX = (worldX - camera.x) * camera.zoom + canvas.width / 2;
    const screenY = (worldY - camera.y) * camera.zoom + canvas.height / 2;
    return { x: screenX, y: screenY };
  }, [camera.x, camera.y, camera.zoom]);

  const getWorldMousePos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    
    const worldX = (screenX - canvas.width / 2) / camera.zoom + camera.x;
    const worldY = (screenY - canvas.height / 2) / camera.zoom + camera.y;

    return { x: worldX, y: worldY };
  }, [camera.x, camera.y, camera.zoom]);

  const findSnapPoint = (worldPos: Point): SnapPoint | null => {
    const snapDistSq = (SNAP_DISTANCE / camera.zoom) ** 2;
    const candidates: { point: SnapPoint, distSq: number, object: DuctPart }[] = [];

    for (const obj of objects) {
        const points: SnapPoint[] = [
            ...obj.getConnectors().map(p => ({ ...p, type: 'connector' as const, objectId: obj.id })),
            ...obj.getIntersectionPoints().map(p => ({ ...p, type: 'intersection' as const, objectId: obj.id }))
        ];

        for (const p of points) {
            const distSq = (worldPos.x - p.x)**2 + (worldPos.y - p.y)**2;
            if (distSq < snapDistSq) {
                 candidates.push({
                    distSq: distSq,
                    point: p,
                    object: obj,
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
    let bestCandidate = closestCandidates.find(c => c.object.type !== 'StraightDuct');
    
    // If no fitting is among the closest, just take the first one (which could be a straight duct)
    if (!bestCandidate) {
        bestCandidate = closestCandidates[0];
    }
    
    return bestCandidate.point;
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const parent = canvas.parentElement!;

    const resizeObserver = new ResizeObserver(() => {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    });
    resizeObserver.observe(parent);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setContextMenu(null);
      const worldMousePos = getWorldMousePos(e.clientX, e.clientY);
      zoomCamera(e.deltaY, worldMousePos);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      resizeObserver.unobserve(parent);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [zoomCamera, getWorldMousePos]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    
    let animationFrameId: number;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);
      
      objects.forEach(obj => obj.draw(ctx, camera));
      
      const radius = 8 / camera.zoom;
      const rectSize = 12 / camera.zoom;
      objects.forEach(obj => {
          obj.getConnectors().forEach(c => {
              ctx.beginPath(); ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'; ctx.fill();
          });
          obj.getIntersectionPoints().forEach(p => {
              ctx.fillStyle = 'rgba(96, 165, 250, 0.7)'; ctx.fillRect(p.x - rectSize/2, p.y - rectSize/2, rectSize, rectSize);
          });
      });

      if (mode === 'measure') {
        const p1 = measureStartPoint || lastWorldMousePos.current;
        const p2 = lastWorldMousePos.current;

        if (currentSnapPoint) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.arc(currentSnapPoint.x, currentSnapPoint.y, 12 / camera.zoom, 0, 2 * Math.PI);
            ctx.stroke();
        }

        if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#db2777';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.stroke();

            const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (distance > 0.1) { // Only show label if there is a distance
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                
                ctx.save();
                ctx.translate(midX, midY);
                ctx.font = `${18 / camera.zoom}px sans-serif`;
                const text = `L: ${distance.toFixed(1)}`;
                const textMetrics = ctx.measureText(text);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(-textMetrics.width/2 - 5/camera.zoom, -15/camera.zoom, textMetrics.width + 10/camera.zoom, 22/camera.zoom);
                ctx.fillStyle = '#db2777';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }
        }
      }

      const dimensionGroups = new Map<string, DimensionLine[]>();
      dimensions.forEach(dim => {
          const p1 = getPointForDim(objects, dim.p1_objectId, dim.p1_pointType, dim.p1_pointId);
          const p2 = getPointForDim(objects, dim.p2_objectId, dim.p2_pointType, dim.p2_pointId);
          if (!p1 || !p2) return;

          let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          if (angle < 0) angle += Math.PI;
          
          const A = p1.y - p2.y;
          const B = p2.x - p1.x;
          const C = p1.x * p2.y - p2.x * p1.y;
          const perpDist = C / Math.sqrt(A*A + B*B);

          const key = `${angle.toFixed(2)}|${(perpDist / 10).toFixed(0)}`; 
          
          if (!dimensionGroups.has(key)) {
              dimensionGroups.set(key, []);
          }
          dimensionGroups.get(key)!.push(dim);
      });

      for (const group of dimensionGroups.values()) {
          group.sort((a, b) => {
              const p1a = getPointForDim(objects, a.p1_objectId, a.p1_pointType, a.p1_pointId)!;
              const p1b = getPointForDim(objects, b.p1_objectId, b.p1_pointType, b.p1_pointId)!;
              const p2a = getPointForDim(objects, a.p2_objectId, a.p2_pointType, a.p2_pointId)!;
              const angle = Math.atan2(p2a.y - p1a.y, p2a.x - p1a.x);
              const dirX = Math.cos(angle);
              const dirY = Math.sin(angle);
              const posA = p1a.x * dirX + p1a.y * dirY;
              const posB = p1b.x * dirX + p1b.y * dirY;
              return posA - posB;
          });

      dimensions.forEach((dim, indexInGroup) => {
        dim.draw(ctx, camera, objects, getPointForDim, indexInGroup);
      });

      updateStraightRunDimensions(); // ★ ここで呼び出しを追加
      }

      ctx.restore();

      if (selectedObjectId !== null) {
        const selectedObject = objects.find(o => o.id === selectedObjectId);
        if (selectedObject) {
          const { x, y } = worldToScreen(selectedObject.x, selectedObject.y);
          // Position the menu above the object, horizontally centered.
          const menuY = y - 50 - (selectedObject.diameter / 2) * camera.zoom;
          setContextMenu({ x: x, y: menuY });
        }
      } else {
        setContextMenu(null);
      }

      animationFrameId = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [objects, dimensions, camera, selectedObjectId, measureStartPoint, currentSnapPoint, mode, worldToScreen, getPointForDim, updateStraightRunDimensions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        }
        if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
        return; // Prevent other shortcuts when Ctrl/Meta is pressed
      }

      if (selectedObjectId !== null) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          rotateSelectedObject();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          deleteObject(selectedObjectId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedObjectId, undo, redo, rotateSelectedObject, deleteObject]);

  useEffect(() => {
    // Do not run on initial render
    if (screenshotTrigger === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const originalSelectedId = selectedObjectId;
    
    // Temporarily deselect object for a clean screenshot
    if (originalSelectedId !== null) {
      selectObject(null);
    }

    // Allow state to update and canvas to re-render before taking the shot
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `duct-design-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Restore selection if there was one
      if (originalSelectedId !== null) {
        selectObject(originalSelectedId);
      }
    }, 100); // 100ms delay is a pragmatic way to wait for re-render

  }, [screenshotTrigger]); // Dependency array only needs the trigger

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
        setInteractionMode('pinch');
        const pointers = Array.from(activePointers.current.values());
        pinchState.current.initialDist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        return;
    }

    if (e.button !== 0) return;

    if (mode === 'measure') {
        if (currentSnapPoint) {
            if (!measureStartPoint) {
                setMeasureStartPoint(currentSnapPoint);
            } else {
                setEditingDimension({ p1: measureStartPoint, p2: currentSnapPoint });
                setMeasureStartPoint(null);
            }
        }
        return;
    }

    const worldPos = getWorldMousePos(e.clientX, e.clientY);
    setContextMenu(null);
    const clickedObject = [...objects].reverse().find(obj => obj.isPointInside(worldPos.x, worldPos.y));

    if (clickedObject) {
      selectObject(clickedObject.id);
      setInteractionMode('drag');
      const dragGroupId = clickedObject.groupId;
      const groupToDrag = objects.filter(obj => obj.groupId === dragGroupId).map(obj => ({ obj, initialX: obj.x, initialY: obj.y }));
      dragInfo.current = { target: clickedObject, group: groupToDrag, worldStartX: worldPos.x, worldStartY: worldPos.y, hasDragged: false };
      e.currentTarget.style.cursor = 'move';
    } else {
      selectObject(null);
      setInteractionMode('pan');
      panStart.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const worldPos = getWorldMousePos(e.clientX, e.clientY);
    lastWorldMousePos.current = worldPos;

    if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (interactionMode === 'pinch' && activePointers.current.size === 2) {
        const pointers = Array.from(activePointers.current.values());
        const newDist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        const delta = pinchState.current.initialDist - newDist;

        const midpoint = { x: (pointers[0].x + pointers[1].x) / 2, y: (pointers[0].y + pointers[1].y) / 2 };
        const worldMousePosForZoom = getWorldMousePos(midpoint.x, midpoint.y);

        zoomCamera(delta * 2, worldMousePosForZoom); // Multiply delta for more sensitivity
        pinchState.current.initialDist = newDist;
        return;
    }

    if (mode === 'measure') {
        setCurrentSnapPoint(findSnapPoint(worldPos));
        return;
    }

    if (interactionMode === 'pan') {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      panCamera(dx, dy);
      panStart.current = { x: e.clientX, y: e.clientY };
    } else if (interactionMode === 'drag' && dragInfo.current.target) {
      dragInfo.current.hasDragged = true;
      const total_dx = worldPos.x - dragInfo.current.worldStartX;
      const total_dy = worldPos.y - dragInfo.current.worldStartY;
      dragInfo.current.group.forEach(item => {
        updateObjectPosition(item.obj.id, item.initialX + total_dx, item.initialY + total_dy);
      });
    }
  };
  
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);

    if (interactionMode === 'pinch') {
        if (activePointers.current.size < 2) {
            setInteractionMode('idle');
        }
        return;
    }

    if (interactionMode === 'drag' && dragInfo.current.target && dragInfo.current.hasDragged) {
      const { group } = dragInfo.current;
      const draggedGroupId = dragInfo.current.target.groupId;

      let bestSnap = { dist: CONNECT_DISTANCE / camera.zoom, dx: 0, dy: 0, otherGroupId: -1 };

      // Check for snaps from the final dragged position
      for (const item of group) {
          const draggedObj = objects.find(o => o.id === item.obj.id)!;
          for (const tc of draggedObj.getConnectors()) {
              for (const otherObject of objects) {
                  if (otherObject.groupId !== draggedGroupId) {
                      for (const c of otherObject.getConnectors()) {
                          if (tc.diameter === c.diameter) {
                              const dist = Math.hypot(tc.x - c.x, tc.y - c.y);
                              if (dist < bestSnap.dist) {
                                  bestSnap = { dist, dx: c.x - tc.x, dy: c.y - tc.y, otherGroupId: otherObject.groupId };
                              }
                          }
                      }
                  }
              }
          }
      }

      let connectionMade = false;
      if (bestSnap.otherGroupId !== -1) {
          // A snap was found, apply final snap translation to the entire group
          group.forEach(item => {
              const objToUpdate = objects.find(o => o.id === item.obj.id)!;
              updateObjectPosition(objToUpdate.id, objToUpdate.x + bestSnap.dx, objToUpdate.y + bestSnap.dy);
          });
          mergeGroups(draggedGroupId, bestSnap.otherGroupId);
          connectionMade = true;
      }
      
      if (dragInfo.current.hasDragged || connectionMade) {
          saveHistory();
      }
    }

    setInteractionMode('idle');
    e.currentTarget.style.cursor = 'grab';
  };

  const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => e.preventDefault();

  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const itemJson = e.dataTransfer.getData('application/json');
    if (!itemJson) return;
    try {
      const item = JSON.parse(itemJson) as PaletteItemData;
      const { x, y } = getWorldMousePos(e.clientX, e.clientY);
      addObject(item.type, { ...item.defaultOptions, x, y });
    } catch (error) {
      console.error("Failed to parse dropped data:", error);
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-200">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp} // Use same handler for leave
        onPointerCancel={handlePointerUp} // And for cancel
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ cursor: 'grab', touchAction: 'none', width: '100%', height: '100%' }}
      />
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => selectObject(null)}
        />
      )}
      {editingDimension && (
        <DimensionModal 
            dimension={editingDimension}
            onCancel={() => setEditingDimension(null)}
            onApply={(newLength) => {
                applyDimensionAdjustment(editingDimension.p1, editingDimension.p2, newLength);
                setEditingDimension(null);
            }}
        />
      )}
    </div>
  );
};

export default CanvasArea;
