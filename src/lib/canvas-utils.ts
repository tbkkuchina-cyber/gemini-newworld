import { Camera, AnyDuctPart, Point, SnapPoint, Dimension, Connector, IntersectionPoint } from "./types"; // Import Connector and IntersectionPoint
import { createDuctPart } from "./duct-models";

// getColorForDiameter, drawGrid, drawObjects, screenToWorld, worldToScreen, getObjectAt remain the same
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
  // Adjust calculation based on canvas actual size vs CSS size if necessary
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (screenPoint.x - rect.left) * scaleX;
  const canvasY = (screenPoint.y - rect.top) * scaleY;

  const worldX = (canvasX - canvas.width / 2) / camera.zoom + (canvas.width / 2 - camera.x);
  const worldY = (canvasY - canvas.height / 2) / camera.zoom + (canvas.height / 2 - camera.y);
  return { x: worldX, y: worldY };
}


export function worldToScreen(worldPoint: Point, canvas: HTMLCanvasElement, camera: Camera): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (worldPoint.x - (canvas.width / 2 - camera.x)) * camera.zoom + canvas.width / 2;
  const canvasY = (worldPoint.y - (canvas.height / 2 - camera.y)) * camera.zoom + canvas.height / 2;

  const screenX = canvasX / scaleX + rect.left;
  const screenY = canvasY / scaleY + rect.top;

  // Return coordinates relative to the viewport, adjust if relative to canvas bounds is needed
  return { x: screenX - rect.left, y: screenY - rect.top };
}


// Updated to use the new createDuctPart signature
export function getObjectAt(worldPoint: Point, objects: AnyDuctPart[]): AnyDuctPart | null {
  // Check fittings first (reverse order)
  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    if (obj.type !== 'Straight') { // Assuming 'Straight' is the only non-fitting type needing lower priority
        const model = createDuctPart(obj);
        if (model && model.isPointInside(worldPoint.x, worldPoint.y)) {
          return obj;
        }
    }
  }
  // Then check straight ducts
   for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'Straight') {
          const model = createDuctPart(obj);
          if (model && model.isPointInside(worldPoint.x, worldPoint.y)) {
            return obj;
          }
      }
   }
  return null;
}

// --- FIX: Add export here ---
// Updated to use the new createDuctPart signature
export function findNearestConnector(worldPoint: Point, objects: AnyDuctPart[], camera: Camera): SnapPoint | null {
  let bestMatch = { dist: Infinity, point: null as SnapPoint | null };
  const snapDist = 20 / camera.zoom; // Use a constant screen distance for snapping

  for (const obj of objects) {
    const model = createDuctPart(obj);
    if (model) {
      for (const c of model.getConnectors()) {
        const dist = Math.hypot(worldPoint.x - c.x, worldPoint.y - c.y);
        if (dist < snapDist && dist < bestMatch.dist) {
          bestMatch = {
            dist,
            point: {
              x: c.x, // Ensure point coordinates are included
              y: c.y, // Ensure point coordinates are included
              objId: obj.id,
              pointId: c.id,
              pointType: 'connector',
              // diameter: c.diameter // Optionally include diameter if needed later
            },
          };
        }
      }
      // Optionally add snapping to intersection points here if needed
      // for (const p of model.getIntersectionPoints()) { ... }
    }
  }
  return bestMatch.point;
}
// -----------------------------


// Helper function to get the actual point coordinate for a dimension endpoint
// Needs access to the full objects list
function getPointForDim(objId: number, pointType: 'connector' | 'intersection', pointId: number | string, objects: AnyDuctPart[]): Point | null {
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


// --- Helper function to draw arrowheads ---
// Ported from the original duct-app-script.js
function drawArrow(ctx: CanvasRenderingContext2D, camera: Camera, fromX: number, fromY: number, toX: number, toY: number) {
    const headlen = 8 / camera.zoom; // Adjust arrow size based on zoom
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Draw arrowhead at 'to' end
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Draw arrowhead at 'from' end
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    // Corrected angle for the 'from' arrowhead (opposite direction)
    ctx.lineTo(fromX + headlen * Math.cos(angle - Math.PI / 6), fromY + headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(fromX + headlen * Math.cos(angle + Math.PI / 6), fromY + headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}


// --- Rewritten drawDimensions function ---
// Incorporates grouping, offset, extension lines, and arrows from the original
export function drawDimensions(ctx: CanvasRenderingContext2D, dimensions: Dimension[], objects: AnyDuctPart[], camera: Camera) {
    ctx.save();
    // Default style
    ctx.strokeStyle = '#0284c7'; // sky-600
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 1.5 / camera.zoom; // Adjust line width based on zoom
    ctx.font = `${16 / camera.zoom}px sans-serif`; // Adjust font size based on zoom
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; // Place text slightly above the dimension line

    const dimensionGroups = new Map<string, (Dimension & { p1: Point, p2: Point })[]>();

    // 1. Group dimensions by angle and perpendicular distance
    dimensions.forEach(dim => {
        const p1 = getPointForDim(dim.p1_objId, dim.p1_pointType, dim.p1_pointId, objects);
        const p2 = getPointForDim(dim.p2_objId, dim.p2_pointType, dim.p2_pointId, objects);
        if (!p1 || !p2) return;

        // Normalize angle to 0 <= angle < PI
        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        if (angle < 0) angle += Math.PI; // Ensure angle is in [0, PI) range
        if (Math.abs(angle - Math.PI) < 1e-6) angle = 0; // Treat PI as 0 for grouping horizontal lines consistently

        const A = p1.y - p2.y;
        const B = p2.x - p1.x;
        const C = p1.x * p2.y - p2.x * p1.y;
        const mag = Math.sqrt(A*A + B*B);
        const perpDist = mag === 0 ? 0 : C / mag; // Signed perpendicular distance from origin

        const angleKey = angle.toFixed(3); // Group similar angles
        const distKey = Math.round(perpDist / 10); // Group lines roughly 10 units apart
        const key = `${angleKey}|${distKey}`;

        if (!dimensionGroups.has(key)) {
            dimensionGroups.set(key, []);
        }
        dimensionGroups.get(key)!.push({ ...dim, p1, p2 });
    });

    // 2. Draw dimensions group by group
    for (const group of dimensionGroups.values()) {
        group.sort((a, b) => {
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
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // red-500
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            } else {
                ctx.strokeStyle = '#0284c7'; // sky-600
                ctx.fillStyle = '#0284c7';
            }

            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const perpAngle = angle - Math.PI / 2; // Angle perpendicular to the dimension line

            const baseOffset = 60;
            const offsetIncrement = 25;
            const offsetDist = (baseOffset + (indexInGroup * offsetIncrement)) / camera.zoom;
            const extensionOverhang = 10 / camera.zoom; // How far extension lines go past the dim line

            const perpDx = Math.cos(perpAngle);
            const perpDy = Math.sin(perpAngle);

            const p1_dim = { x: p1.x + offsetDist * perpDx, y: p1.y + offsetDist * perpDy };
            const p2_dim = { x: p2.x + offsetDist * perpDx, y: p2.y + offsetDist * perpDy };

            const p1_ext_start = { x: p1.x, y: p1.y }; // Start at the object point
            const p1_ext_end = { x: p1_dim.x + extensionOverhang * perpDx, y: p1_dim.y + extensionOverhang * perpDy };
            const p2_ext_start = { x: p2.x, y: p2.y }; // Start at the object point
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
            ctx.restore(); // Restore alpha and line width

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
            const textHeight = parseInt(ctx.font) * 1.2; // Estimate height based on font size

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white background
            ctx.fillRect(
                -textMetrics.width / 2 - textPadding, // Center horizontally
                -textHeight + textPadding, // Position above the line (textBaseline is 'bottom')
                textMetrics.width + 2 * textPadding,
                textHeight
            );

            if (isStraightRun) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            } else {
                ctx.fillStyle = '#0284c7';
            }
            ctx.fillText(text, 0, 0); // textBaseline is 'bottom', so draws above y=0

            ctx.restore(); // Restore translation/rotation
        });
    }

    ctx.restore(); // Restore initial context state
}

// ... rest of the file (drawAllSnapPoints, drawMeasureTool) ...
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

// drawMeasureTool remains the same for now, but uses zoom-adjusted sizes implicitly via camera in useCanvas
export function drawMeasureTool(ctx: CanvasRenderingContext2D, measurePointsSnap: SnapPoint[], mouseWorldPos: Point | null, camera: Camera, objects: AnyDuctPart[]) {
    if (measurePointsSnap.length === 0 && !mouseWorldPos) return;

    ctx.save();
    ctx.strokeStyle = '#db2777'; // pink-600
    ctx.fillStyle = '#db2777';
    ctx.lineWidth = 2 / camera.zoom;
    const pointRadius = 5 / camera.zoom;
    const fontSize = 16 / camera.zoom;
    ctx.font = `${fontSize}px sans-serif`;

    const pointsToDraw = measurePointsSnap.map(p => ({ x: p.x, y: p.y }));
    let currentPos = mouseWorldPos;

    // Highlight the snap point under the cursor if measuring
    if (mouseWorldPos && measurePointsSnap.length < 2) {
        const snapHighlight = findNearestConnector(mouseWorldPos, objects, camera); // Re-use findNearestConnector logic if available globally or pass objects
        if (snapHighlight) {
             currentPos = snapHighlight; // Use the snapped point for drawing the line end
             ctx.save();
             ctx.strokeStyle = '#4f46e5'; // Highlight color
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
                -textHeight - textPadding, // Position above the line
                textMetrics.width + 2 * textPadding,
                textHeight
            );

            ctx.fillStyle = '#db2777';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, 0, -textPadding * 2); // Adjust y-offset for padding

            ctx.restore();
        }
    }
    ctx.restore();
}
// --- FIX: Remove duplicate/incorrect declaration ---
// export declare function findNearestConnector(worldPoint: Point, objects: AnyDuctPart[], camera: Camera): SnapPoint | null;
// ---------------------------------------------------
