import { Camera, AnyDuctPart, Point, SnapPoint, Dimension, Connector, IntersectionPoint, DuctPartType } from "./types";
import { createDuctPart } from "./duct-models"; 

// getColorForDiameter (変更なし)
const DIAMETER_COLORS: Record<string | number, string> = {
    default: '#60a5fa',
    100: '#93c5fd',
    125: '#6ee7b7',
    150: '#fde047',
    175: '#fca5a5',
    200: '#d8b4fe',
    250: '#fdba74',
};
export function getColorForDiameter(diameter: number): string {
    return DIAMETER_COLORS[diameter] || DIAMETER_COLORS.default;
}

// =================================================================================
// Drawing Functions
// =================================================================================

// drawGrid, drawObjects (変更なし)
export function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const worldLeft = (0 - canvasWidth / 2) / camera.zoom + (canvasWidth / 2 - camera.x);
    const worldTop = (0 - canvasHeight / 2) / camera.zoom + (canvasHeight / 2 - camera.y);
    const worldRight = (canvasWidth - canvasWidth / 2) / camera.zoom + (canvasWidth / 2 - camera.x);
    const worldBottom = (canvasHeight - canvasHeight / 2) / camera.zoom + (canvasHeight / 2 - camera.y);
    const gridSize = 50; 
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1 / camera.zoom;
    const startX = Math.floor(worldLeft / gridSize) * gridSize;
    const endX = Math.ceil(worldRight / gridSize) * gridSize;
    const startY = Math.floor(worldTop / gridSize) * gridSize;
    const endY = Math.ceil(worldBottom / gridSize) * gridSize;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.moveTo(x, worldTop);
        ctx.lineTo(x, worldBottom);
    }
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.moveTo(worldLeft, y);
        ctx.lineTo(worldRight, y);
    }
    ctx.stroke();
}
export function drawObjects(ctx: CanvasRenderingContext2D, objects: AnyDuctPart[], camera: Camera) {
  for (const obj of objects) {
    const model = createDuctPart(obj);
    if (model) {
      model.draw(ctx, camera);
    }
  }
}

// =================================================================================
// Coordinate and Hit-Test Functions
// =================================================================================

// screenToWorld, worldToScreen, getObjectAt, findNearestConnector (変更なし)
export function screenToWorld(screenPoint: Point, canvas: HTMLCanvasElement, camera: Camera): Point {
  const cssX = screenPoint.x; 
  const cssY = screenPoint.y;
  const canvasWidth = canvas.width; 
  const canvasHeight = canvas.height;
  const worldX = (cssX - canvasWidth / 2) / camera.zoom + (canvasWidth / 2 - camera.x);
  const worldY = (cssY - canvasHeight / 2) / camera.zoom + (canvasHeight / 2 - camera.y);
  return { x: worldX, y: worldY };
}
export function worldToScreen(worldPoint: Point, canvas: HTMLCanvasElement, camera: Camera): Point {
  const canvasWidth = canvas.width; 
  const canvasHeight = canvas.height; 
  const canvasX = (worldPoint.x - (canvasWidth / 2 - camera.x)) * camera.zoom + canvasWidth / 2;
  const canvasY = (worldPoint.y - (canvasHeight / 2 - camera.y)) * camera.zoom + canvasHeight / 2;
  return { x: canvasX, y: canvasY };
}
export function getObjectAt(worldPoint: Point, objects: AnyDuctPart[]): AnyDuctPart | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.type !== DuctPartType.Straight) { 
        const model = createDuctPart(obj);
        if (model && model.isPointInside(worldPoint.x, worldPoint.y)) {
          return obj;
        }
    }
  }
   for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === DuctPartType.Straight) {
          const model = createDuctPart(obj);
          if (model && model.isPointInside(worldPoint.x, worldPoint.y)) {
            return obj;
          }
      }
   }
  return null;
}
export function findNearestConnector(worldPoint: Point, objects: AnyDuctPart[], camera: Camera): SnapPoint | null {
  let bestMatch = { dist: Infinity, point: null as SnapPoint | null };
  const snapDist = 20 / camera.zoom; 
  for (const obj of objects) {
    const model = createDuctPart(obj);
    if (model) {
      for (const c of model.getConnectors()) {
        const dist = Math.hypot(worldPoint.x - c.x, worldPoint.y - c.y);
        if (dist < snapDist && dist < bestMatch.dist) {
          bestMatch = {
            dist,
            point: {
              x: c.x,
              y: c.y, 
              objId: obj.id,
              pointId: c.id,
              pointType: 'connector',
            },
          };
        }
      }
      for (const p of model.getIntersectionPoints()) {
         const dist = Math.hypot(worldPoint.x - p.x, worldPoint.y - p.y);
         if (dist < snapDist && dist < bestMatch.dist) {
            bestMatch = {
                dist,
                point: {
                    x: p.x,
                    y: p.y,
                    objId: obj.id,
                    pointId: p.id,
                    pointType: 'intersection'
                }
            };
         }
      }
    }
  }
  return bestMatch.point;
}


// (getPointForDim をエクスポート (drawDimensions が使用))
export function getPointForDim(objId: number, pointType: 'connector' | 'intersection', pointId: number | string, objects: AnyDuctPart[]): Point | null {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return null;
    const model = createDuctPart(obj);
    if (!model) return null;

    let point: Point | Connector | IntersectionPoint | undefined | null = null;
    if (pointType === 'connector') {
        point = model.getConnectors().find(p => p.id === pointId);
    } else {
        point = model.getIntersectionPoints().find(p => p.id === pointId);
    }
    return point ? { x: point.x, y: point.y } : null;
};

// ... (drawArrow は変更なし) ...
function drawArrow(ctx: CanvasRenderingContext2D, camera: Camera, fromX: number, fromY: number, toX: number, toY: number) {
    const headlen = 8 / camera.zoom; 
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(fromX + headlen * Math.cos(angle - Math.PI / 6), fromY + headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(fromX + headlen * Math.cos(angle + Math.PI / 6), fromY + headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

// ★★★ 修正点: `a.1.x` を `a.p1.x` に修正 (ビルドエラー対応) ★★★
export function drawDimensions(ctx: CanvasRenderingContext2D, dimensions: Dimension[], objects: AnyDuctPart[], camera: Camera) {
    ctx.save();
    ctx.strokeStyle = '#0284c7';
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 1.5 / camera.zoom; 
    ctx.font = `${16 / camera.zoom}px sans-serif`; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; 

    const dimensionGroups = new Map<string, (Dimension & { p1: Point, p2: Point })[]>();

    dimensions.forEach(dim => {
        const p1 = getPointForDim(dim.p1_objId, dim.p1_pointType, dim.p1_pointId, objects);
        const p2 = getPointForDim(dim.p2_objId, dim.p2_pointType, dim.p2_pointId, objects);
        if (!p1 || !p2) return;
        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        if (angle < 0) angle += Math.PI; 
        if (Math.abs(angle - Math.PI) < 1e-6) angle = 0; 
        const A = p1.y - p2.y;
        const B = p2.x - p1.x;
        const C = p1.x * p2.y - p2.x * p1.y;
        const mag = Math.sqrt(A*A + B*B);
        const perpDist = mag === 0 ? 0 : C / mag; 
        const angleKey = angle.toFixed(3); 
        const distKey = Math.round(perpDist / 10); 
        const key = `${angleKey}|${distKey}`;
        if (!dimensionGroups.has(key)) {
            dimensionGroups.set(key, []);
        }
        dimensionGroups.get(key)!.push({ ...dim, p1, p2 });
    });

    for (const group of dimensionGroups.values()) {
        group.sort((a, b) => {
            // ★★★ (タイポ `a.1.x` を `a.p1.x` に修正) ★★★
            const angle = Math.atan2(a.p2.y - a.p1.y, a.p2.x - a.p1.x); 
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            const posA = a.p1.x * dirX + a.p1.y * dirY;
            const posB = b.p1.x * dirX + b.p1.y * dirY;
            return posA - posB;
        });

        group.forEach((dimData, indexInGroup) => {
            const { p1, p2, value, isStraightRun } = dimData;

            if (isStraightRun) {
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; 
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            } else {
                ctx.strokeStyle = '#0284c7'; 
                ctx.fillStyle = '#0284c7';
            }

            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const perpAngle = angle - Math.PI / 2; 

            const baseOffset = 60;
            const offsetIncrement = 25;
            const offsetDist = (baseOffset + (indexInGroup * offsetIncrement)) / camera.zoom;
            const extensionOverhang = 10 / camera.zoom; 

            const perpDx = Math.cos(perpAngle);
            const perpDy = Math.sin(perpAngle);

            const p1_dim = { x: p1.x + offsetDist * perpDx, y: p1.y + offsetDist * perpDy };
            const p2_dim = { x: p2.x + offsetDist * perpDx, y: p2.y + offsetDist * perpDy };

            const p1_ext_start = { x: p1.x, y: p1.y }; 
            const p1_ext_end = { x: p1_dim.x + extensionOverhang * perpDx, y: p1_dim.y + extensionOverhang * perpDy };
            const p2_ext_start = { x: p2.x, y: p2.y }; 
            const p2_ext_end = { x: p2_dim.x + extensionOverhang * perpDx, y: p2_dim.y + extensionOverhang * perpDy };

            ctx.save();
            ctx.strokeStyle = ctx.strokeStyle
            ctx.lineWidth = 1 / camera.zoom;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(p1_ext_start.x, p1_ext_start.y);
            ctx.lineTo(p1_ext_end.x, p1_ext_end.y);
            ctx.moveTo(p2_ext_start.x, p2_ext_start.y);
            ctx.lineTo(p2_ext_end.x, p2_ext_end.y);
            ctx.stroke();
            ctx.restore(); 

            ctx.beginPath();
            ctx.moveTo(p1_dim.x, p1_dim.y);
            ctx.lineTo(p2_dim.x, p2_dim.y);
            ctx.stroke();

            drawArrow(ctx, camera, p1_dim.x, p1_dim.y, p2_dim.x, p2_dim.y);

            const midX = (p1_dim.x + p2_dim.x) / 2;
            const midY = (p1_dim.y + p2_dim.y) / 2;
            const text = value.toFixed(1);

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                ctx.rotate(Math.PI);
            }

            const textMetrics = ctx.measureText(text);
            const textPadding = 2 / camera.zoom;
            const textHeight = parseInt(ctx.font) * 1.2; 

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; 
            ctx.fillRect(
                -textMetrics.width / 2 - textPadding, 
                -textHeight + textPadding, 
                textMetrics.width + 2 * textPadding,
                textHeight
            );

            if (isStraightRun) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            } else {
                ctx.fillStyle = '#0284c7';
            }
            ctx.fillText(text, 0, 0); 

            ctx.restore(); 
        });
    }

    ctx.restore(); 
}
// (drawAllSnapPoints, drawMeasureTool は変更なし)
// ...
export function drawAllSnapPoints(ctx: CanvasRenderingContext2D, objects: AnyDuctPart[], camera: Camera) {
  const radius = 8 / camera.zoom;
  const rectSize = 12 / camera.zoom;
  const lineWidth = 1 / camera.zoom;

  for (const obj of objects) {
    const model = createDuctPart(obj);
    if (model) {
      // Draw connectors as yellow circles
      ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'; 
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)'; 
      ctx.lineWidth = lineWidth;
      for (const c of model.getConnectors()) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      // Draw intersection points as blue squares
      ctx.fillStyle = 'rgba(96, 165, 250, 0.7)'; 
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; 
      ctx.lineWidth = lineWidth;
      for (const p of model.getIntersectionPoints()) {
        ctx.fillRect(p.x - rectSize / 2, p.y - rectSize / 2, rectSize, rectSize);
        ctx.strokeRect(p.x - rectSize / 2, p.y - rectSize / 2, rectSize, rectSize);
      }
    }
  }
}
export function drawMeasureTool(ctx: CanvasRenderingContext2D, measurePointsSnap: SnapPoint[], mouseWorldPos: Point | null, camera: Camera, objects: AnyDuctPart[]) {
    if (measurePointsSnap.length === 0 && !mouseWorldPos) return;

    ctx.save();
    ctx.strokeStyle = '#db2777'; 
    ctx.fillStyle = '#db2777';
    ctx.lineWidth = 2 / camera.zoom;
    const pointRadius = 5 / camera.zoom;
    const fontSize = 16 / camera.zoom;
    ctx.font = `${fontSize}px sans-serif`;

    const pointsToDraw = measurePointsSnap.map(p => ({ x: p.x, y: p.y }));
    let currentPos = mouseWorldPos;

    if (mouseWorldPos && measurePointsSnap.length < 2) {
        const snapHighlight = findNearestConnector(mouseWorldPos, objects, camera); 
        if (snapHighlight) {
             currentPos = snapHighlight; 
             ctx.save();
             ctx.strokeStyle = '#4f46e5'; 
             ctx.lineWidth = 2 / camera.zoom;
             ctx.beginPath();
             ctx.arc(snapHighlight.x, snapHighlight.y, 8 / camera.zoom, 0, 2 * Math.PI);
             ctx.stroke();
             ctx.restore();
        }
    }


    if (pointsToDraw.length > 0 && currentPos) {
        pointsToDraw.push(currentPos);
    }

    for (let i = 0; i < pointsToDraw.length; i++) {
        const p = pointsToDraw[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        if (i > 0) {
            const p_prev = pointsToDraw[i - 1];
            ctx.beginPath();
            ctx.moveTo(p_prev.x, p_prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            const distance = Math.hypot(p.x - p_prev.x, p.y - p_prev.y);
            const midX = (p.x + p_prev.x) / 2;
            const midY = (p.y + p_prev.y) / 2;
            const angle = Math.atan2(p.y - p_prev.y, p.x - p_prev.x);

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
             if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                ctx.rotate(Math.PI);
            }

            const text = `${distance.toFixed(1)}`;
            const textMetrics = ctx.measureText(text);
            const textPadding = 2 / camera.zoom;
            const textHeight = fontSize * 1.2;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(
                -textMetrics.width / 2 - textPadding,
                -textHeight - textPadding, 
                textMetrics.width + 2 * textPadding,
                textHeight
            );

            ctx.fillStyle = '#db2777';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, 0, -textPadding * 2); 

            ctx.restore();
        }
    }
    ctx.restore();
}