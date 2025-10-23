import {
  AnyDuctPart,
  DuctPartType,
  IDuctPart,
  Point,
  Connector,
  StraightDuct,
  Elbow90,
  AdjustableElbow,
  TeeReducer,
  YBranch,
  YBranchReducer,
  Reducer, // Import Reducer type
  Damper,
  Camera,
} from './types';
import { getColorForDiameter } from './canvas-utils';

// Base class, mirroring the structure and methods of the vanilla JS version.
export abstract class DuctPartModel<T extends IDuctPart> {
  protected obj: T;

  constructor(obj: T) {
    this.obj = obj;
  }

  get color(): string { return getColorForDiameter(this.obj.diameter); }

  abstract draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
  
  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void { /* Base implementation can be empty */ }
  
  abstract getConnectors(): Connector[];
  
  getIntersectionPoints(): Point[] { return []; }
  
  abstract isPointInside(px: number, py: number): boolean;
}

// --- Concrete Model Implementations ---

export class StraightDuctModel extends DuctPartModel<StraightDuct | Damper> {
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.obj.x, this.obj.y);
    ctx.rotate(this.obj.rotation * Math.PI / 180);

    const width = this.obj.length;
    const height = this.obj.diameter;

    ctx.fillStyle = this.obj.type === DuctPartType.Damper ? '#9ca3af' : this.color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    
    if (this.obj.isSelected) {
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 4;
        ctx.strokeRect(-width/2 - 5, -height/2 - 5, width + 10, height + 10);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${18 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.obj.systemName} D${this.obj.diameter} L${Math.round(this.obj.length)}`, 0, 0);
    
    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    ctx.moveTo(-this.obj.length / 2, 0);
    ctx.lineTo(this.obj.length / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  getConnectors(): Connector[] {
    const rad = this.obj.rotation * Math.PI / 180;
    const dx = Math.cos(rad) * this.obj.length / 2;
    const dy = Math.sin(rad) * this.obj.length / 2;
    return [
        { id: 0, x: this.obj.x - dx, y: this.obj.y - dy, angle: (this.obj.rotation + 180) % 360, diameter: this.obj.diameter },
        { id: 1, x: this.obj.x + dx, y: this.obj.y + dy, angle: this.obj.rotation, diameter: this.obj.diameter }
    ];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.obj.x;
    const dy = py - this.obj.y;
    const rad = -this.obj.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    return Math.abs(localX) <= this.obj.length / 2 && Math.abs(localY) <= this.obj.diameter / 2;
  }
}

export class Elbow90Model extends DuctPartModel<Elbow90> {
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void { //... existing implementation ... 
    }
    //... existing implementation ...
}

export class AdjustableElbowModel extends DuctPartModel<AdjustableElbow> {
    //... existing implementation ...
}

export class TeeReducerModel extends DuctPartModel<TeeReducer> {
    //... existing implementation ...
}

export class YBranchModel extends DuctPartModel<YBranch | YBranchReducer> {
    //... existing implementation ...
}

export class ReducerModel extends DuctPartModel<Reducer> {
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.obj.x, this.obj.y);
        ctx.rotate(this.obj.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        const halfLen = this.obj.length / 2;
        const d1_half = this.obj.diameter / 2;
        const d2_half = this.obj.diameter2 / 2;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(-halfLen, -d1_half);
        ctx.lineTo(halfLen, -d2_half);
        ctx.lineTo(halfLen, d2_half);
        ctx.lineTo(-halfLen, d1_half);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (this.obj.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${this.obj.diameter}-${this.obj.diameter2} L:${this.obj.length}`, 0, Math.max(d1_half, d2_half) + 15 / camera.zoom);

        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.obj.length / 2, 0);
        ctx.lineTo(this.obj.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    getConnectors(): Connector[] {
        const rad = this.obj.rotation * Math.PI / 180;
        const dx = Math.cos(rad) * this.obj.length / 2;
        const dy = Math.sin(rad) * this.obj.length / 2;
        return [
            { id: 0, x: this.obj.x - dx, y: this.obj.y - dy, angle: (this.obj.rotation + 180) % 360, diameter: this.obj.diameter },
            { id: 1, x: this.obj.x + dx, y: this.obj.y + dy, angle: this.obj.rotation, diameter: this.obj.diameter2 }
        ];
    }

    isPointInside(px: number, py: number): boolean {
        const dx = px - this.obj.x;
        const dy = py - this.obj.y;
        const rad = -this.obj.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        const maxDiameter = Math.max(this.obj.diameter, this.obj.diameter2);

        if (Math.abs(localX) > this.obj.length / 2 || Math.abs(localY) > maxDiameter / 2) {
            return false;
        }

        const slope = (this.obj.diameter2 - this.obj.diameter) / this.obj.length;
        const expectedDiameterAtX = this.obj.diameter + slope * (localX + this.obj.length / 2);
        
        return Math.abs(localY) <= expectedDiameterAtX / 2;
    }
}


// A generic factory function to create the appropriate model
export function createDuctPart(obj: AnyDuctPart): DuctPartModel<any> | null {
  switch (obj.type) {
    case DuctPartType.Straight:
    case DuctPartType.Damper:
      return new StraightDuctModel(obj as StraightDuct | Damper);
    case DuctPartType.Elbow90:
        return new Elbow90Model(obj as Elbow90);
    case DuctPartType.Elbow:
    case DuctPartType.AdjustableElbow:
        return new AdjustableElbowModel(obj as AdjustableElbow);
    case DuctPartType.TeeReducer:
        return new TeeReducerModel(obj as TeeReducer);
    case DuctPartType.YBranch:
    case DuctPartType.YBranchReducer:
        return new YBranchModel(obj as YBranch | YBranchReducer);
    case DuctPartType.Reducer:
        return new ReducerModel(obj as Reducer);
    default:
      return null; // Return null for unimplemented types
  }
}