
import { Camera, AnyDuctPart, StraightDuct, Point, Elbow90, AdjustableElbow, TeeReducer, YBranch, YBranchReducer, Reducer, Damper, SnapPoint, Dimension } from "./types";
import { createDuctPart } from "./duct-models";

// =================================================================================
// Color Definitions
// =================================================================================
const DIAMETER_COLORS: Record<string | number, string> = {
    default: '#60a5fa', // blue-400
    100: '#93c5fd',   // blue-300
    125: '#6ee7b7',   // emerald-300
    150: '#fde047',   // yellow-300
    175: '#fca5a5',   // red-300
    200: '#d8b4fe',   // purple-300
    250: '#fdba74',   // orange-300
};

function getColorForDiameter(diameter: number): string {
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

function drawStraightDuct(ctx: CanvasRenderingContext2D, part: StraightDuct, camera: Camera) {
    const { length, diameter, systemName, isSelected, rotation } = part;
    const width = length;
    const height = diameter;

    ctx.fillStyle = getColorForDiameter(diameter);
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4 / camera.zoom;
        ctx.strokeRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = `${systemName} D${diameter} L${Math.round(length)}`;
    const textMetrics = ctx.measureText(text);

    const angle = (rotation % 360 + 360) % 360;
    const isUpsideDown = angle > 90 && angle < 270;

    ctx.save();
    if (isUpsideDown) {
        ctx.rotate(Math.PI);
    }

    if (textMetrics.width > (width - 20) * camera.zoom) {
        // Draw with leader line if text is too wide
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(60 / camera.zoom, height/2 + 60 / camera.zoom);
        ctx.lineTo(textMetrics.width / (2 * camera.zoom) + 70 / camera.zoom, height/2 + 60 / camera.zoom);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillText(text, 70 / camera.zoom, height/2 + 60 / camera.zoom);
    } else {
        // Draw text inside the duct
        ctx.fillText(text, 0, 0);
    }
    ctx.restore();
}

function drawElbow90(ctx: CanvasRenderingContext2D, part: Elbow90, camera: Camera) {
    const { legLength, diameter, isSelected, rotation } = part;
    
    ctx.strokeStyle = getColorForDiameter(diameter);
    ctx.lineWidth = diameter;
    ctx.lineCap = 'butt';

    ctx.beginPath();
    ctx.moveTo(0, legLength);
    ctx.lineTo(0, 0);
    ctx.lineTo(legLength, 0);
    ctx.stroke();

    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = diameter + 8 / camera.zoom;
        ctx.globalAlpha = 0.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(0, legLength);
        ctx.lineTo(0, 0);
        ctx.lineTo(legLength, 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${14 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const text = `D${diameter} L:${legLength}`;

    // Text on horizontal leg
    const angle1 = (rotation % 360 + 360) % 360;
    const isUpsideDown1 = angle1 > 90 && angle1 < 270;
    ctx.save();
    if (isUpsideDown1) {
        ctx.rotate(Math.PI);
    }
    ctx.fillText(text, legLength / 2, -diameter / 2 - 5 / camera.zoom);
    ctx.restore();
    
    // Text on vertical leg
    const angle2 = ((rotation + 270) % 360 + 360) % 360;
    const isUpsideDown2 = angle2 > 90 && angle2 < 270;
    ctx.save();
    ctx.translate(0, legLength);
    ctx.rotate(-Math.PI / 2);
    if (isUpsideDown2) {
         ctx.rotate(Math.PI);
    }
    ctx.fillText(text, legLength / 2, -diameter / 2 - 5 / camera.zoom);
    ctx.restore();
}

function drawAdjustableElbow(ctx: CanvasRenderingContext2D, part: AdjustableElbow, camera: Camera) {
    const { legLength, angle, diameter, isFlipped, isSelected, rotation } = part;
    const currentAngle = isFlipped ? -angle : angle;
    const angleRad = currentAngle * Math.PI / 180;

    const leg1X = legLength * Math.cos(-angleRad / 2);
    const leg1Y = -legLength * Math.sin(-angleRad / 2);
    const leg2X = legLength * Math.cos(angleRad / 2);
    const leg2Y = -legLength * Math.sin(angleRad / 2);

    ctx.strokeStyle = getColorForDiameter(diameter);
    ctx.lineWidth = diameter;
    ctx.lineCap = 'butt';
    
    ctx.beginPath();
    ctx.moveTo(leg1X, leg1Y);
    ctx.lineTo(0, 0);
    ctx.lineTo(leg2X, leg2Y);
    ctx.stroke();

    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = diameter + 8 / camera.zoom;
        ctx.globalAlpha = 0.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${14 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    const text = `D${diameter} L:${legLength}`;

    const placeTextOnLeg = (legAngle: number) => {
        const worldAngleDeg = rotation + (legAngle * 180 / Math.PI);
        const effectiveAngle = (worldAngleDeg % 360 + 360) % 360;
        const isUpsideDown = effectiveAngle > 90 && effectiveAngle < 270;

        ctx.save();
        ctx.translate((legLength / 2) * Math.cos(legAngle), (legLength / 2) * Math.sin(legAngle));
        ctx.rotate(legAngle);
        if (isUpsideDown) {
            ctx.rotate(Math.PI);
        }
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, 0, -diameter / 2 - 5 / camera.zoom);
        ctx.restore();
    };

    placeTextOnLeg(-angleRad / 2);
    placeTextOnLeg(angleRad / 2);
}

function drawTeeReducer(ctx: CanvasRenderingContext2D, part: TeeReducer, camera: Camera) {
    const { length, branchLength, diameter, diameter2, diameter3, intersectionOffset, isFlipped, isSelected, rotation } = part;
    const branchY = isFlipped ? branchLength : -branchLength;

    // Branch
    ctx.fillStyle = getColorForDiameter(diameter3);
    ctx.fillRect(intersectionOffset - diameter3 / 2, 0, diameter3, branchY);
    ctx.strokeRect(intersectionOffset - diameter3 / 2, 0, diameter3, branchY);

    // Main
    ctx.fillStyle = getColorForDiameter(diameter);
    ctx.fillRect(-length / 2, -diameter / 2, length, diameter);
    ctx.strokeRect(-length / 2, -diameter / 2, length, diameter);

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4 / camera.zoom;
        const b = { x: -length/2, y: -diameter/2, w: length, h: diameter }; // Simplified bounds
        ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${14 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    
    // Main pipe text
    const mainAngle = (rotation % 360 + 360) % 360;
    const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;

    ctx.save();
    if (mainIsUpsideDown) {
        ctx.rotate(Math.PI);
    }
    const leftLength = length / 2 + intersectionOffset;
    const rightLength = length / 2 - intersectionOffset;
    const leftTextX = (-length / 2 + intersectionOffset) / 2;
    const rightTextX = (intersectionOffset + length / 2) / 2;

    ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
    ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, diameter / 2 + 5 / camera.zoom);
    ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, diameter / 2 + 5 / camera.zoom);
    
    ctx.textBaseline = 'middle';
    ctx.fillText(`D${diameter}-${diameter2}`, 0, 0);
    ctx.restore();
    
    // Branch pipe text
    const branchAngle = (rotation + (isFlipped ? 90 : 270)) % 360;
    const branchIsUpsideDown = ((branchAngle % 360 + 360) % 360 > 90 && (branchAngle % 360 + 360) % 360 < 270);
    
    ctx.save();
    ctx.translate(intersectionOffset, branchY / 2);
    ctx.rotate(isFlipped ? Math.PI / 2 : -Math.PI / 2);
    if (branchIsUpsideDown) {
        ctx.rotate(Math.PI);
    }
    ctx.textBaseline = 'bottom';
    ctx.fillText(`D${diameter3} L:${branchLength}`, 0, -diameter3 / 2 - 5 / camera.zoom);
    ctx.restore();
}

function drawYBranch(ctx: CanvasRenderingContext2D, part: YBranch<'YBranch'> | YBranchReducer, camera: Camera) {
    const { length, angle, branchLength, intersectionOffset, diameter, isFlipped, isSelected, rotation } = part;
    const currentAngle = isFlipped ? -angle : angle;
    const branchAngleRad = -currentAngle * Math.PI / 180;
    const branchDiameter = (part.type === 'YBranchReducer') ? part.diameter3 : diameter;

    // Branch
    ctx.save();
    ctx.translate(intersectionOffset, 0);
    ctx.rotate(branchAngleRad);
    ctx.fillStyle = getColorForDiameter(branchDiameter);
    ctx.fillRect(0, -branchDiameter / 2, branchLength, branchDiameter);
    ctx.strokeRect(0, -branchDiameter / 2, branchLength, branchDiameter);
    ctx.restore();

    // Main
    ctx.fillStyle = getColorForDiameter(diameter);
    ctx.fillRect(-length / 2, -diameter / 2, length, diameter);
    ctx.strokeRect(-length / 2, -diameter / 2, length, diameter);

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4 / camera.zoom;
        ctx.strokeRect(-length / 2 - 5, -diameter / 2 - 5, length + 10, diameter + 10);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${14 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';

    // Main pipe text
    const mainOutletDiameter = (part.type === 'YBranchReducer') ? part.diameter2 : diameter;
    const mainAngle = (rotation % 360 + 360) % 360;
    const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;

    ctx.save();
    if(mainIsUpsideDown) {
         ctx.rotate(Math.PI);
    }
    const leftLength = length / 2 + intersectionOffset;
    const rightLength = length / 2 - intersectionOffset;
    const leftTextX = (-length / 2 + intersectionOffset) / 2;
    const rightTextX = (intersectionOffset + length / 2) / 2;

    ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
    ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, diameter / 2 + 5 / camera.zoom);
    ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, diameter / 2 + 5 / camera.zoom);

    ctx.textBaseline = 'middle';
    ctx.fillText(`D${diameter}-${mainOutletDiameter}`, 0, 0);
    ctx.restore();

    // Branch pipe text
    const branchWorldAngle = (rotation - angle + 360) % 360;
    const branchIsUpsideDown = branchWorldAngle > 90 && branchWorldAngle < 270;

    ctx.save();
    ctx.translate(intersectionOffset + (branchLength / 2) * Math.cos(branchAngleRad), (branchLength / 2) * Math.sin(branchAngleRad));
    ctx.rotate(branchAngleRad);
    if(branchIsUpsideDown) {
        ctx.rotate(Math.PI);
    }
    ctx.textBaseline = 'bottom';
    ctx.fillText(`D${branchDiameter} L:${branchLength}`, 0, -branchDiameter / 2 - 5 / camera.zoom);
    ctx.restore();
}

function drawReducer(ctx: CanvasRenderingContext2D, part: Reducer, camera: Camera) {
    const { length, diameter, diameter2, isSelected, rotation } = part;
    const halfLen = length / 2;
    const d1_half = diameter / 2;
    const d2_half = diameter2 / 2;

    ctx.fillStyle = getColorForDiameter(diameter);
    ctx.beginPath();
    ctx.moveTo(-halfLen, -d1_half);
    ctx.lineTo(halfLen, -d2_half);
    ctx.lineTo(halfLen, d2_half);
    ctx.lineTo(-halfLen, d1_half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4 / camera.zoom;
        ctx.stroke();
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${14 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    
    const angle = (rotation % 360 + 360) % 360;
    const isUpsideDown = angle > 90 && angle < 270;
    
    ctx.save();
    if (isUpsideDown) {
        ctx.rotate(Math.PI);
    }
    ctx.fillText(`D${diameter}-${diameter2} L:${length}`, 0, Math.max(d1_half, d2_half) + 15 / camera.zoom);
    ctx.restore();
}

function drawDamper(ctx: CanvasRenderingContext2D, part: Damper, camera: Camera) {
    const { length, diameter, isSelected } = part;
    const width = length;
    const height = diameter;

    ctx.fillStyle = '#9ca3af'; // Damper color
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    // Blade
    ctx.beginPath();
    ctx.moveTo(-width / 2 + 5, 0);
    ctx.lineTo(width / 2 - 5, 0);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3 / camera.zoom;
    ctx.stroke();

    if (isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4 / camera.zoom;
        ctx.strokeRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`D${diameter} L${Math.round(length)}`, 0, 0);
}


export function drawObjects(ctx: CanvasRenderingContext2D, objects: AnyDuctPart[], camera: Camera) {
  for (const obj of objects) {
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate(obj.rotation * Math.PI / 180);
    
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 / camera.zoom;

    switch (obj.type) {
      case 'StraightDuct':
        drawStraightDuct(ctx, obj, camera);
        break;
      case 'Elbow90':
        drawElbow90(ctx, obj, camera);
        break;
      case 'AdjustableElbow':
        drawAdjustableElbow(ctx, obj, camera);
        break;
      case 'TeeReducer':
        drawTeeReducer(ctx, obj, camera);
        break;
      case 'YBranch':
      case 'YBranchReducer':
        drawYBranch(ctx, obj, camera);
        break;
      case 'Reducer':
        drawReducer(ctx, obj, camera);
        break;
      case 'Damper':
        drawDamper(ctx, obj, camera);
        break;
      default:
        console.warn('Unknown duct part type:', (obj as any).type);
    }
    ctx.restore();
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
    const model = createDuctPart(obj);
    if (model && model.isPointInside(worldPoint)) {
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
    const model = createDuctPart(obj);
    if (!model) return null;
    const connectors = model.getConnectors();
    const point = connectors.find(p => p.id === pointId);
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
    const model = createDuctPart(obj);
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
