'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { DuctPart, DimensionLine } from '@/lib/objects';
import { PaletteItemData } from '@/lib/types';
import ContextMenu from '@/components/ContextMenu';

const CONNECT_DISTANCE = 50;
const SNAP_DISTANCE = 20;

interface Point {
  x: number;
  y: number;
}

interface SnapPoint extends Point {
    id: string | number;
    type: 'connector' | 'intersection';
    objectId: number;
}

// ★ 寸法入力モーダルコンポーネント
const DimensionModal = ({ dimension, onApply, onCancel }: { dimension: {p1: Point, p2: Point}, onApply: (newLength: number) => void, onCancel: () => void }) => {
    const initialValue = Math.hypot(dimension.p2.x - dimension.p1.x, dimension.p2.y - dimension.p1.y);
    const [value, setValue] = useState(initialValue.toFixed(1));

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
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    autoFocus
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
    addDimension,
    saveHistory,
    recalculateGroups,
    mode,
  } = useAppStore();

  const [interactionMode, setInteractionMode] = useState<'idle' | 'pan' | 'drag'>('idle');
  const dragInfo = useRef({
    target: null as DuctPart | null,
    group: [] as { obj: DuctPart, initialX: number, initialY: number }[],
    startX: 0,
    startY: 0,
    hasDragged: false,
  });

  const panStart = useRef({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const [measureStartPoint, setMeasureStartPoint] = useState<SnapPoint | null>(null);
  const [currentSnapPoint, setCurrentSnapPoint] = useState<SnapPoint | null>(null);
  const [editingDimension, setEditingDimension] = useState<{p1: SnapPoint, p2: SnapPoint} | null>(null);

  const worldToScreen = (worldX: number, worldY: number) => {
    const canvas = canvasRef.current!;
    const screenX = (worldX - camera.x) * camera.zoom + canvas.width / 2;
    const screenY = (worldY - camera.y) * camera.zoom + canvas.height / 2;
    return { x: screenX, y: screenY };
  };

  const getWorldMousePos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    
    const worldX = (screenX - canvas.width / 2) / camera.zoom + camera.x;
    const worldY = (screenY - canvas.height / 2) / camera.zoom + camera.y;

    return { x: worldX, y: worldY };
  };

  const findSnapPoint = (worldPos: Point): SnapPoint | null => {
    const snapDistSq = (SNAP_DISTANCE / camera.zoom) ** 2;
    let closestSnap: { point: SnapPoint, distSq: number } | null = null;

    for (const obj of objects) {
        const points = [
            ...obj.getConnectors().map(p => ({ ...p, type: 'connector' as const, objectId: obj.id })),
            ...obj.getIntersectionPoints().map(p => ({ ...p, type: 'intersection' as const, objectId: obj.id }))
        ];

        for (const p of points) {
            const distSq = (worldPos.x - p.x)**2 + (worldPos.y - p.y)**2;
            if (distSq < snapDistSq && (!closestSnap || distSq < closestSnap.distSq)) {
                closestSnap = { point: p, distSq };
            }
        }
    }
    return closestSnap ? closestSnap.point : null;
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
  }, [zoomCamera]);

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
        if (currentSnapPoint) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.arc(currentSnapPoint.x, currentSnapPoint.y, 12 / camera.zoom, 0, 2 * Math.PI);
            ctx.stroke();
        }
        if (measureStartPoint && currentSnapPoint) {
            ctx.beginPath(); ctx.moveTo(measureStartPoint.x, measureStartPoint.y); ctx.lineTo(currentSnapPoint.x, currentSnapPoint.y); ctx.strokeStyle = '#db2777'; ctx.stroke();
        }
      }

      dimensions.forEach(dim => { /* ... */ });

      ctx.restore();

      if (selectedObjectId !== null) {
        const selectedObject = objects.find(o => o.id === selectedObjectId);
        if (selectedObject) {
          const { x, y } = worldToScreen(selectedObject.x, selectedObject.y);
          setContextMenu({ x: x + 50, y: y });
        }
      } else {
        setContextMenu(null);
      }

      animationFrameId = window.requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [objects, dimensions, camera, selectedObjectId, measureStartPoint, currentSnapPoint]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
      dragInfo.current = { target: clickedObject, group: groupToDrag, startX: worldPos.x, startY: worldPos.y, hasDragged: false };
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
      const total_dx = worldPos.x - dragInfo.current.startX;
      const total_dy = worldPos.y - dragInfo.current.startY;
      dragInfo.current.group.forEach(item => {
        updateObjectPosition(item.obj.id, item.initialX + total_dx, item.initialY + total_dy);
      });
    }
  };
  
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionMode === 'drag' && dragInfo.current.target && dragInfo.current.hasDragged) {
      const { group, startX, startY } = dragInfo.current;
      const worldPos = getWorldMousePos(e.clientX, e.clientY);
      const total_dx = worldPos.x - startX;
      const total_dy = worldPos.y - startY;

      if (group.length === 1) {
        let bestSnap = { dist: CONNECT_DISTANCE, dx: 0, dy: 0 };
        const draggedConnectors = group[0].obj.getConnectors();
        for (const otherObject of objects) {
          if (group[0].obj.id === otherObject.id) continue;
          for (const otherConn of otherObject.getConnectors()) {
            for (const draggedConn of draggedConnectors) {
              if (draggedConn.diameter === otherConn.diameter) {
                const dist = Math.hypot(draggedConn.x - otherConn.x, draggedConn.y - otherConn.y);
                if (dist < bestSnap.dist) {
                  bestSnap = { dist, dx: otherConn.x - draggedConn.x, dy: otherConn.y - draggedConn.y };
                }
              }
            }
          }
        }
        if (bestSnap.dist < CONNECT_DISTANCE) {
          group.forEach(item => {
              updateObjectPosition(item.obj.id, item.initialX + total_dx + bestSnap.dx, item.initialY + total_dy + bestSnap.dy);
          });
        }
      }
      
      recalculateGroups();
      saveHistory();
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
        onPointerLeave={handlePointerUp}
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
                console.log("Applying new length:", newLength);
                // TODO: Call applyDimensionAdjustment action
                addDimension(editingDimension.p1, editingDimension.p2); // 仮で追加
                setEditingDimension(null);
            }}
        />
      )}
    </div>
  );
};

export default CanvasArea;
