
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

export function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera) {
  const gridSize = 50;
  const scaledGridSize = gridSize * camera.zoom;
  const xOffset = (camera.x * camera.zoom) % scaledGridSize;
  const yOffset = (camera.y * camera.zoom) % scaledGridSize;

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 / camera.zoom;

  for (let x = -xOffset; x < canvasWidth; x += scaledGridSize) {
      ctx.beginPath();
      const worldX = (x - canvasWidth / 2) / camera.zoom + canvasWidth / 2 - camera.x;
      ctx.moveTo(worldX, -camera.y);
      ctx.lineTo(worldX, canvasHeight / camera.zoom - camera.y);
      ctx.stroke();
  }

  for (let y = -yOffset; y < canvasHeight; y += scaledGridSize) {
      ctx.beginPath();
      const worldY = (y - canvasHeight / 2) / camera.zoom + canvasHeight / 2 - camera.y;
      ctx.moveTo(-camera.x, worldY);
      ctx.lineTo(canvasWidth / camera.zoom - camera.x, worldY);
      ctx.stroke();
  }
}

export function drawObjects(ctx: CanvasRenderingContext2D, objects: AnyDuctPart[], camera: Camera) {
  for (const obj of objects) {
    const model = createDuctPart(obj.type, obj as Omit<IDuctPart<any>, 'type'>);
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
  const worldX = (screenPoint.x - rect.width / 2) / camera.zoom + rect.width / 2 - camera.x;
  const worldY = (screenPoint.y - rect.height / 2) / camera.zoom + rect.height / 2 - camera.y;
  return { x: worldX, y: worldY };
}

export function worldToScreen(worldPoint: Point, canvas: HTMLCanvasElement, camera: Camera): Point {
  const rect = canvas.getBoundingClientRect();
  const screenX = (worldPoint.x - (rect.width / 2 - camera.x)) * camera.zoom + rect.width / 2;
  const screenY = (worldPoint.y - (rect.height / 2 - camera.y)) * camera.zoom + rect.height / 2;
  return { x: screenX, y: screenY };
}

export function getObjectAt(worldPoint: Point, objects: AnyDuctPart[]): AnyDuctPart | null {
  // Iterate through objects in reverse order to pick the topmost one if they overlap
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    const model = createDuctPart(obj.type, obj as Omit<IDuctPart<any>, 'type'>);
    if (model && model.isPointInside(worldPoint.x, worldPoint.y)) {
      return obj;
    }
  }
  return null;
}

export function drawMeasureTool(ctx: CanvasRenderingContext2D, measurePoints: Point[], mousePos: Point | null, camera: Camera) {
  if (measurePoints.length === 0 && !mousePos) return;

  ctx.strokeStyle = '#db2777'; // pink-600
  ctx.fillStyle = '#db2777';
  ctx.lineWidth = 2 / camera.zoom;

  const pointsToDraw = [...measurePoints];
  if (measurePoints.length > 0 && mousePos) {
    pointsToDraw.push(mousePos);
  }

  for (let i = 0; i < pointsToDraw.length; i++) {
    const p = pointsToDraw[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 / camera.zoom, 0, 2 * Math.PI);
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
      ctx.font = `${14 / camera.zoom}px sans-serif`;
      const text = `${distance.toFixed(1)} mm`;
      const textMetrics = ctx.measureText(text);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(-textMetrics.width/2 - 2, -10 / camera.zoom, textMetrics.width + 4, 18 / camera.zoom);
      ctx.fillStyle = '#db2777';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
}

export function findNearestConnector(worldPoint: Point, objects: AnyDuctPart[], camera: Camera): SnapPoint | null {
  let bestMatch = { dist: Infinity, point: null as SnapPoint | null };
  const snapDist = 20 / camera.zoom;

  for (const obj of objects) {
    const model = createDuctPart(obj.type, obj as Omit<IDuctPart<any>, 'type'>);
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
              pointType: 'connector', // Assuming only connectors for now
            },
          };
        }
      }
    }
  }
  return bestMatch.point;
}

function getPointForDim(objId: number, pointId: number | string, objects: AnyDuctPart[]): Point | null {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return null;
    const model = createDuctPart(obj!.type, obj! as Omit<IDuctPart<any>, 'type'>);
    if (!model) return null;
    const point = model.getConnectors().find(c => c.id === pointId);
    return point ? { x: point.x, y: point.y } : null;
};

export function drawDimensions(ctx: CanvasRenderingContext2D, dimensions: Dimension[], objects: AnyDuctPart[], camera: Camera) {
    ctx.save();
    ctx.strokeStyle = '#0284c7'; // sky-600
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.font = `${14 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const dim of dimensions) {
        const p1 = getPointForDim(dim.p1_objId, dim.p1_pointId, objects);
        const p2 = getPointForDim(dim.p2_objId, dim.p2_pointId, objects);

        if (!p1 || !p2) continue;

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const perpAngle = angle - Math.PI / 2;
        const offsetDist = 60 / camera.zoom;

        const perpDx = Math.cos(perpAngle);
        const perpDy = Math.sin(perpAngle);

        const p1_dim = { x: p1.x + offsetDist * perpDx, y: p1.y + offsetDist * perpDy };
        const p2_dim = { x: p2.x + offsetDist * perpDx, y: p2.y + offsetDist * perpDy };

        // Dimension line
        ctx.beginPath();
        ctx.moveTo(p1_dim.x, p1_dim.y);
        ctx.lineTo(p2_dim.x, p2_dim.y);
        ctx.stroke();

        // Dimension text
        const midX = (p1_dim.x + p2_dim.x) / 2;
        const midY = (p1_dim.y + p2_dim.y) / 2;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
            ctx.rotate(Math.PI);
        }
        const text = dim.value.toFixed(1);
        ctx.fillText(text, 0, -5 / camera.zoom);
        ctx.restore();
    }

    ctx.restore();
}
export function drawConnectors(ctx: CanvasRenderingContext2D, objects: AnyDuctPart[], camera: Camera) {
  const radius = 6 / camera.zoom;
  ctx.fillStyle = 'rgba(255, 193, 7, 0.7)';

  for (const obj of objects) {
    const model = createDuctPart(obj.type, obj as Omit<IDuctPart<any>, 'type'>);
    if (model) {
      const connectors = model.getConnectors();
      for (const c of connectors) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
}
