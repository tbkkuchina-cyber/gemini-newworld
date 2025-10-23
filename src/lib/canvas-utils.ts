import { Camera, AnyDuctPart, Point, SnapPoint, Dimension, IDuctPart } from "./types";
import { createDuctPart } from "./duct-models";

const DIAMETER_COLORS: Record<string | number, string> = {
    default: '#60a5fa', // blue-400
    100: '#93c5fd',   // blue-300
    125: '#6ee7b7',   // emerald-300
    150: '#fde047',   // yellow-300
    175: '#fca5a5',   // red-300
    200: '#d8b4fe',   // purple-300
    250: '#fdba74',   // orange-300
};

export function getColorForDiameter(diameter: number): string {
    return DIAMETER_COLORS[diameter] || DIAMETER_COLORS.default;
}

// =================================================================================
// Drawing Functions
// =================================================================================

// Rewritten to be simpler. Assumes the context is already transformed.
export function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera) {
  const canvasWidth = ctx.canvas.width / camera.zoom;
  const canvasHeight = ctx.canvas.height / camera.zoom;
  const viewLeft = -camera.x;
  const viewTop = -camera.y;

  const gridSize = 50;
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 / camera.zoom;

  const startX = Math.floor(viewLeft / gridSize) * gridSize;
  const endX = viewLeft + canvasWidth;
  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, viewTop);
    ctx.lineTo(x, viewTop + canvasHeight);
    ctx.stroke();
  }

  const startY = Math.floor(viewTop / gridSize) * gridSize;
  const endY = viewTop + canvasHeight;
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(viewLeft, y);
    ctx.lineTo(viewLeft + canvasWidth, y);
    ctx.stroke();
  }
}

// Updated to use the new createDuctPart signature
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

export function screenToWorld(screenPoint: Point, canvas: HTMLCanvasElement, camera: Camera): Point {
  const rect = canvas.getBoundingClientRect();
  const worldX = (screenPoint.x - rect.width / 2) / camera.zoom + (rect.width / 2 - camera.x);
  const worldY = (screenPoint.y - rect.height / 2) / camera.zoom + (rect.height / 2 - camera.y);
  return { x: worldX, y: worldY };
}

export function worldToScreen(worldPoint: Point, canvas: HTMLCanvasElement, camera: Camera): Point {
  const rect = canvas.getBoundingClientRect();
  const screenX = (worldPoint.x - (rect.width / 2 - camera.x)) * camera.zoom + rect.width / 2;
  const screenY = (worldPoint.y - (rect.height / 2 - camera.y)) * camera.zoom + rect.height / 2;
  return { x: screenX, y: screenY };
}

// Updated to use the new createDuctPart signature
export function getObjectAt(worldPoint: Point, objects: AnyDuctPart[]): AnyDuctPart | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const model = createDuctPart(obj);
    if (model && model.isPointInside(worldPoint.x, worldPoint.y)) {
      return obj;
    }
  }
  return null;
}

// Updated to use the new createDuctPart signature
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
              ...c,
              objId: obj.id,
              pointId: c.id,
              pointType: 'connector',
            },
          };
        }
      }
    }
  }
  return bestMatch.point;
}

// Updated to use the new createDuctPart signature
function getPointForDim(objId: number, pointId: number | string, objects: AnyDuctPart[]): Point | null {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return null;
    const model = createDuctPart(obj);
    if (!model) return null;
    const point = model.getConnectors().find(c => c.id === pointId);
    return point ? { x: point.x, y: point.y } : null;
};

// Updated to work without manual scaling
export function drawDimensions(ctx: CanvasRenderingContext2D, dimensions: Dimension[], objects: AnyDuctPart[]) {
    ctx.save();
    ctx.strokeStyle = '#0284c7'; // sky-600
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.font = `14px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const dim of dimensions) {
        const p1 = getPointForDim(dim.p1_objId, dim.p1_pointId, objects);
        const p2 = getPointForDim(dim.p2_objId, dim.p2_pointId, objects);

        if (!p1 || !p2) continue;

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const perpAngle = angle - Math.PI / 2;
        const offsetDist = 60;

        const perpDx = Math.cos(perpAngle);
        const perpDy = Math.sin(perpAngle);

        const p1_dim = { x: p1.x + offsetDist * perpDx, y: p1.y + offsetDist * perpDy };
        const p2_dim = { x: p2.x + offsetDist * perpDx, y: p2.y + offsetDist * perpDy };

        ctx.beginPath();
        ctx.moveTo(p1_dim.x, p1_dim.y);
        ctx.lineTo(p2_dim.x, p2_dim.y);
        ctx.stroke();

        const midX = (p1_dim.x + p2_dim.x) / 2;
        const midY = (p1_dim.y + p2_dim.y) / 2;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
            ctx.rotate(Math.PI);
        }
        const text = dim.value.toFixed(1);
        ctx.fillText(text, 0, -5);
        ctx.restore();
    }

    ctx.restore();
}

// Updated to use the new createDuctPart signature
export function drawAllSnapPoints(ctx: CanvasRenderingContext2D, objects: AnyDuctPart[], camera: Camera) {
  const radius = 8 / camera.zoom;
  const rectSize = 12 / camera.zoom;
  const lineWidth = 1 / camera.zoom;

  for (const obj of objects) {
    const model = createDuctPart(obj);
    if (model) {
      // Draw connectors as yellow circles
      ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'; // amber-400
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)'; // amber-600
      ctx.lineWidth = lineWidth;
      for (const c of model.getConnectors()) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      // Draw intersection points as blue squares
      ctx.fillStyle = 'rgba(96, 165, 250, 0.7)'; // blue-400
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // blue-500
      ctx.lineWidth = lineWidth;
      for (const p of model.getIntersectionPoints()) {
        ctx.fillRect(p.x - rectSize / 2, p.y - rectSize / 2, rectSize, rectSize);
        ctx.strokeRect(p.x - rectSize / 2, p.y - rectSize / 2, rectSize, rectSize);
      }
    }
  }
}

// drawMeasureTool needs to be updated as well to remove manual scaling
export function drawMeasureTool(ctx: CanvasRenderingContext2D, measurePoints: Point[], mousePos: Point | null) {
  if (measurePoints.length === 0 && !mousePos) return;

  ctx.strokeStyle = '#db2777'; // pink-600
  ctx.fillStyle = '#db2777';
  ctx.lineWidth = 2;

  const pointsToDraw = [...measurePoints];
  if (measurePoints.length > 0 && mousePos) {
    pointsToDraw.push(mousePos);
  }

  for (let i = 0; i < pointsToDraw.length; i++) {
    const p = pointsToDraw[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
    ctx.fill();

    if (i > 0) {
      const p_prev = pointsToDraw[i-1];
      ctx.beginPath();
      ctx.moveTo(p_prev.x, p_prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      const distance = Math.hypot(p.x - p_prev.x, p.y - p_prev.y);
      const midX = (p.x + p_prev.x) / 2;
      const midY = (p.y + p_prev.y) / 2;
      
      ctx.save();
      ctx.translate(midX, midY);
      ctx.font = `14px sans-serif`;
      const text = `${distance.toFixed(1)} mm`;
      const textMetrics = ctx.measureText(text);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(-textMetrics.width/2 - 2, -10, textMetrics.width + 4, 18);
      ctx.fillStyle = '#db2777';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
}