import {
  DuctPartType,
  IDuctPart,
  Point,
  StraightDuct,
  ElbowDuct,
  ReducerDuct,
  BranchDuct,
  CapDuct,
  TeeDuct,
  Camera,
  Connector,
} from './types';
import { getColorForDiameter } from './canvas-utils';


export abstract class DuctPart<T extends DuctPartType> implements IDuctPart<T> {
  id: number;
  groupId: number;
  x: number;
  y: number;
  rotation: number;
  diameter: number;
  systemName: string;
  type: T;
  isSelected: boolean;
  isFlipped: boolean;
  data: IDuctPart<T>['data'];
  name: string;

  constructor(data: IDuctPart<T>) {
    this.id = data.id;
    this.groupId = data.groupId;
    this.x = data.x;
    this.y = data.y;
    this.rotation = data.rotation;
    this.diameter = data.diameter;
    this.systemName = data.systemName;
    this.type = data.type;
    this.isSelected = data.isSelected;
    this.isFlipped = data.isFlipped;
    this.data = data.data;
    this.name = data.name;
  }

  get color(): string { return getColorForDiameter(this.diameter); }

  abstract draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
  abstract drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void;
  abstract getConnectors(): Connector[];
  abstract getIntersectionPoints(): Point[];
  abstract isPointInside(px: number, py: number): boolean;

  rotate(): void { this.rotation = (this.rotation + 45) % 360; }
  flip(): void { this.isFlipped = !this.isFlipped; }
}

export class StraightDuctPart extends DuctPart<DuctPartType.Straight> {
  constructor(data: IDuctPart<DuctPartType.Straight>) {
    super(data);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);

    const width = this.data.length;
    const height = this.diameter;

    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([]);
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    if (this.isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 4 / camera.zoom;
      ctx.strokeRect(-width / 2 - 5 / camera.zoom, -height / 2 - 5 / camera.zoom, width + 10 / camera.zoom, height + 10 / camera.zoom);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${18 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = `${this.systemName} D${this.diameter} L${Math.round(this.data.length)}`;
    const textMetrics = ctx.measureText(text);

    const angle = (this.rotation % 360 + 360) % 360;
    const isUpsideDown = angle > 90 && angle < 270;

    ctx.save();
    if (isUpsideDown) {
      ctx.rotate(Math.PI);
    }

    if (textMetrics.width > width - 20 / camera.zoom) {
      // Draw with leader line if text is too wide for the duct
      ctx.beginPath();
      ctx.moveTo(0, 0); // Start line from center
      ctx.lineTo(60 / camera.zoom, height / 2 + 60 / camera.zoom); // End line diagonally down-right
      ctx.lineTo(textMetrics.width / 2 + 70 / camera.zoom, height / 2 + 60 / camera.zoom); // Horizontal part
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1 / camera.zoom;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillText(text, 70 / camera.zoom, height / 2 + 60 / camera.zoom);
    } else {
      // Draw text inside the duct
      ctx.fillText(text, 0, 0);
    }
    ctx.restore();

    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    ctx.moveTo(-this.data.length / 2, 0);
    ctx.lineTo(this.data.length / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  getConnectors(): Connector[] {
    const rad = this.rotation * Math.PI / 180;
    const dx = Math.cos(rad) * this.data.length / 2;
    const dy = Math.sin(rad) * this.data.length / 2;
    return [
      { id: 0, x: this.x - dx, y: this.y - dy, angle: (this.rotation + 180) % 360, diameter: this.diameter },
      { id: 1, x: this.x + dx, y: this.y + dy, angle: this.rotation, diameter: this.diameter }
    ];
  }

  getIntersectionPoints(): Point[] {
    return [];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const rad = -this.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    return Math.abs(localX) <= this.data.length / 2 && Math.abs(localY) <= this.diameter / 2;
  }
}

export class ElbowDuctPart extends DuctPart<DuctPartType.Elbow> {
  constructor(data: IDuctPart<DuctPartType.Elbow>) {
    super(data);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.setLineDash([]);

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.diameter;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    ctx.beginPath();
    ctx.moveTo(0, this.data.radius);
    ctx.lineTo(0, 0);
    ctx.lineTo(this.data.radius, 0);
    ctx.stroke();

    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    if (this.isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = (this.diameter + 8) / camera.zoom;
      ctx.globalAlpha = 0.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(0, this.data.radius);
      ctx.lineTo(0, 0);
      ctx.lineTo(this.data.radius, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const text = `D${this.diameter} R:${this.data.radius}`;

    // Text on horizontal leg
    const angle1 = (this.rotation % 360 + 360) % 360;
    const isUpsideDown1 = angle1 > 90 && angle1 < 270;
    ctx.save();
    if (isUpsideDown1) {
      ctx.rotate(Math.PI);
    }
    ctx.fillText(text, this.data.radius / 2, -this.diameter / 2 - 5 / camera.zoom);
    ctx.restore();

    // Text on vertical leg
    const angle2 = ((this.rotation + 270) % 360 + 360) % 360;
    const isUpsideDown2 = angle2 > 90 && angle2 < 270;
    ctx.save();
    ctx.translate(0, this.data.radius);
    ctx.rotate(-Math.PI / 2);
    if (isUpsideDown2) {
      ctx.rotate(Math.PI);
    }
    ctx.fillText(text, this.data.radius / 2, -this.diameter / 2 - 5 / camera.zoom);
    ctx.restore();

    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    ctx.moveTo(0, this.data.radius);
    ctx.lineTo(0, 0);
    ctx.lineTo(this.data.radius, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  getConnectors(): Connector[] {
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const c1_local = { x: 0, y: this.data.radius };
    const c2_local = { x: this.data.radius, y: 0 };

    const rotate = (p: Point) => ({
      x: this.x + p.x * cos - p.y * sin,
      y: this.y + p.x * sin + p.y * cos
    });

    return [
      { id: 0, ...rotate(c1_local), angle: (this.rotation + 270) % 360, diameter: this.diameter },
      { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter }
    ];
  }

  getIntersectionPoints(): Point[] {
    return [{ x: this.x, y: this.y }];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const rad = -this.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const leg1 = (localX >= -this.diameter / 2 && localX <= this.diameter / 2 && localY >= 0 && localY <= this.data.radius);
    const leg2 = (localY >= -this.diameter / 2 && localY <= this.diameter / 2 && localX >= 0 && localX <= this.data.radius);

    return leg1 || leg2;
  }
}

export class ReducerDuctPart extends DuctPart<DuctPartType.Reducer> {
  constructor(data: IDuctPart<DuctPartType.Reducer>) {
    super(data);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.setLineDash([]);

    const halfLen = this.data.length / 2;
    const d1_half = this.data.startDiameter / 2;
    const d2_half = this.data.endDiameter / 2;

    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 / camera.zoom;

    ctx.beginPath();
    ctx.moveTo(-halfLen, -d1_half);
    ctx.lineTo(halfLen, -d2_half);
    ctx.lineTo(halfLen, d2_half);
    ctx.lineTo(-halfLen, d1_half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (this.isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 4 / camera.zoom;
      ctx.stroke();
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';

    const angle = (this.rotation % 360 + 360) % 360;
    const isUpsideDown = angle > 90 && angle < 270;

    ctx.save();
    if (isUpsideDown) {
      ctx.rotate(Math.PI);
    }
    ctx.fillText(`D${this.data.startDiameter}-${this.data.endDiameter} L:${this.data.length}`, 0, Math.max(d1_half, d2_half) + 15 / camera.zoom);
    ctx.restore();

    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    ctx.moveTo(-this.data.length / 2, 0);
    ctx.lineTo(this.data.length / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  getConnectors(): Connector[] {
    const rad = this.rotation * Math.PI / 180;
    const dx = Math.cos(rad) * this.data.length / 2;
    const dy = Math.sin(rad) * this.data.length / 2;
    return [
      { id: 0, x: this.x - dx, y: this.y - dy, angle: (this.rotation + 180) % 360, diameter: this.data.startDiameter },
      { id: 1, x: this.x + dx, y: this.y + dy, angle: this.rotation, diameter: this.data.endDiameter }
    ];
  }

  getIntersectionPoints(): Point[] {
    return [];
  }

  flip(): void {
    [this.data.startDiameter, this.data.endDiameter] = [this.data.endDiameter, this.data.startDiameter];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const rad = -this.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const maxDiameter = Math.max(this.data.startDiameter, this.data.endDiameter);

    if (Math.abs(localX) > this.data.length / 2 || Math.abs(localY) > maxDiameter / 2) {
      return false;
    }

    // Calculate the expected half-diameter at localX
    const slope = (this.data.endDiameter - this.data.startDiameter) / this.data.length;
    const expectedDiameterAtX = this.data.startDiameter + slope * (localX + this.data.length / 2);

    return Math.abs(localY) <= expectedDiameterAtX / 2;
  }
}

export class BranchDuctPart extends DuctPart<DuctPartType.Branch> {
  constructor(data: IDuctPart<DuctPartType.Branch>) {
    super(data);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.setLineDash([]);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 / camera.zoom;

    const branchY = this.isFlipped ? this.data.branchLength : -this.data.branchLength;
    const branchTextY = this.isFlipped ? this.data.branchLength / 2 : -this.data.branchLength / 2;
    const branchTextRot = this.isFlipped ? Math.PI / 2 : -Math.PI / 2;

    // Apply intersection offset for branch
    ctx.save();
    ctx.translate(this.data.intersectionOffset, 0);
    ctx.fillStyle = getColorForDiameter(this.data.branchDiameter);
    ctx.fillRect(-this.data.branchDiameter / 2, 0, this.data.branchDiameter, branchY);
    ctx.strokeRect(-this.data.branchDiameter / 2, 0, this.data.branchDiameter, branchY);
    ctx.restore();

    ctx.fillStyle = this.color;
    ctx.fillRect(-this.data.mainLength / 2, -this.data.mainDiameter / 2, this.data.mainLength, this.data.mainDiameter);
    ctx.strokeRect(-this.data.mainLength / 2, -this.data.mainDiameter / 2, this.data.mainLength, this.data.mainDiameter);

    if (this.isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 4 / camera.zoom;
      const b = this.getBounds();
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';

    // Main pipe text
    const mainAngle = (this.rotation % 360 + 360) % 360;
    const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;

    ctx.save();
    if (mainIsUpsideDown) {
      ctx.rotate(Math.PI);
    }
    const leftLength = this.data.mainLength / 2 + this.data.intersectionOffset;
    const rightLength = this.data.mainLength / 2 - this.data.intersectionOffset;
    const leftTextX = (-this.data.mainLength / 2 + this.data.intersectionOffset) / 2;
    const rightTextX = (this.data.intersectionOffset + this.data.mainLength / 2) / 2;

    ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
    ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, this.data.mainDiameter / 2 + 5 / camera.zoom);
    ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, this.data.mainDiameter / 2 + 5 / camera.zoom);

    ctx.textBaseline = 'middle';
    ctx.fillText(`D${this.data.mainDiameter}-${this.data.mainOutletDiameter}`, 0, 0);
    ctx.restore();

    // Branch pipe text
    const branchAngle = (this.rotation + (this.isFlipped ? 90 : 270)) % 360;
    const branchIsUpsideDown = ((branchAngle % 360 + 360) % 360 > 90 && (branchAngle % 360 + 360) % 360 < 270);

    ctx.save();
    ctx.translate(this.data.intersectionOffset, branchTextY);
    ctx.rotate(branchTextRot);
    if (branchIsUpsideDown) {
      ctx.rotate(Math.PI);
    }
    ctx.textBaseline = 'bottom';
    ctx.fillText(`D${this.data.branchDiameter} L:${this.data.branchLength}`, 0, -this.data.branchDiameter / 2 - 5 / camera.zoom);
    ctx.restore();

    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const branchY = this.isFlipped ? this.data.branchLength : -this.data.branchLength;
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    ctx.moveTo(-this.data.mainLength / 2, 0);
    ctx.lineTo(this.data.mainLength / 2, 0);
    ctx.moveTo(this.data.intersectionOffset, 0);
    ctx.lineTo(this.data.intersectionOffset, branchY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  getBounds(): { x: number; y: number; w: number; h: number } {
    const branchY = this.isFlipped ? 0 : -this.data.branchLength;
    const branchH = this.data.branchLength;

    const main = { x: -this.data.mainLength / 2, y: -this.data.mainDiameter / 2, w: this.data.mainLength, h: this.data.mainDiameter };
    const branch = { x: this.data.intersectionOffset - this.data.branchDiameter / 2, y: branchY, w: this.data.branchDiameter, h: branchH };

    const minX = Math.min(main.x, branch.x);
    const minY = Math.min(main.y, branch.y);
    const maxX = Math.max(main.x + main.w, branch.x + branch.w);
    const maxY = Math.max(main.y + main.h, branch.y + branch.h);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  getConnectors(): Connector[] {
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const c1_local = { x: -this.data.mainLength / 2, y: 0 };
    const c2_local = { x: this.data.mainLength / 2, y: 0 };
    const c3_local = { x: this.data.intersectionOffset, y: this.isFlipped ? this.data.branchLength : -this.data.branchLength };
    const c3_angle = this.isFlipped ? (this.rotation + 90) % 360 : (this.rotation - 90 + 360) % 360;


    const rotate = (p: Point) => ({
      x: this.x + p.x * cos - p.y * sin,
      y: this.y + p.x * sin + p.y * cos
    });

    return [
      { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.data.mainDiameter, type: 'main' },
      { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.data.mainOutletDiameter, type: 'main' },
      { id: 2, ...rotate(c3_local), angle: c3_angle, diameter: this.data.branchDiameter, type: 'branch' }
    ];
  }

  getIntersectionPoints(): Point[] {
    const rad = this.rotation * Math.PI / 180;
    const cos_rad = Math.cos(rad);
    const sin_rad = Math.sin(rad);
    const intersection_x = this.x + this.data.intersectionOffset * cos_rad;
    const intersection_y = this.y + this.data.intersectionOffset * sin_rad;
    return [{ x: intersection_x, y: intersection_y }];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const rad = -this.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const inMain = Math.abs(localY) <= this.data.mainDiameter / 2 && Math.abs(localX) <= this.data.mainLength / 2;

    const branchBottom = this.isFlipped ? 0 : -this.data.branchLength;
    const branchTop = this.isFlipped ? this.data.branchLength : 0;
    const inBranch = localY >= branchBottom && localY <= branchTop && Math.abs(localX - this.data.intersectionOffset) <= this.data.branchDiameter / 2;

    return inMain || inBranch;
  }
}

export class CapDuctPart extends DuctPart<DuctPartType.Cap> {
  constructor(data: IDuctPart<DuctPartType.Cap>) {
    super(data);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.setLineDash([]);

    const radius = this.diameter / 2;

    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 / camera.zoom;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    if (this.isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 4 / camera.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 5 / camera.zoom, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Cap D${this.diameter}`, 0, 0);

    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Cap has no centerline
  }

  getConnectors(): Connector[] {
    return []; // Cap has no connectors
  }

  getIntersectionPoints(): Point[] {
    return [{ x: this.x, y: this.y }];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const distance = Math.hypot(dx, dy);
    return distance <= this.diameter / 2;
  }
}

export class TeeDuctPart extends DuctPart<DuctPartType.Tee> {
  constructor(data: IDuctPart<DuctPartType.Tee>) {
    super(data);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.setLineDash([]);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2 / camera.zoom;

    // Main pipe
    ctx.fillStyle = getColorForDiameter(this.data.mainDiameter);
    ctx.fillRect(-this.data.mainLength / 2, -this.data.mainDiameter / 2, this.data.mainLength, this.data.mainDiameter);
    ctx.strokeRect(-this.data.mainLength / 2, -this.data.mainDiameter / 2, this.data.mainLength, this.data.mainDiameter);

    // Branch pipe
    ctx.fillStyle = getColorForDiameter(this.data.branchDiameter);
    ctx.fillRect(-this.data.branchDiameter / 2, -this.data.branchLength / 2, this.data.branchDiameter, this.data.branchLength);
    ctx.strokeRect(-this.data.branchDiameter / 2, -this.data.branchLength / 2, this.data.branchDiameter, this.data.branchLength);


    if (this.isSelected) {
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 4 / camera.zoom;
      // Simplified bounds for selection
      const maxDim = Math.max(this.data.mainDiameter, this.data.branchDiameter, this.data.mainLength, this.data.branchLength);
      ctx.strokeRect(-maxDim / 2 - 5 / camera.zoom, -maxDim / 2 - 5 / camera.zoom, maxDim + 10 / camera.zoom, maxDim + 10 / camera.zoom);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = `${16 / camera.zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Tee D${this.data.mainDiameter}x${this.data.branchDiameter}`, 0, 0);

    this.drawCenterline(ctx, camera);
    ctx.restore();
  }

  drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
    ctx.beginPath();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
    ctx.moveTo(-this.data.mainLength / 2, 0);
    ctx.lineTo(this.data.mainLength / 2, 0);
    ctx.moveTo(0, -this.data.branchLength / 2);
    ctx.lineTo(0, this.data.branchLength / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  getConnectors(): Connector[] {
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const c1_local = { x: -this.data.mainLength / 2, y: 0 };
    const c2_local = { x: this.data.mainLength / 2, y: 0 };
    const c3_local = { x: 0, y: -this.data.branchLength / 2 };
    const c4_local = { x: 0, y: this.data.branchLength / 2 };

    const rotate = (p: Point) => ({
      x: this.x + p.x * cos - p.y * sin,
      y: this.y + p.x * sin + p.y * cos
    });

    return [
      { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.data.mainDiameter },
      { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.data.mainDiameter },
      { id: 2, ...rotate(c3_local), angle: (this.rotation + 270) % 360, diameter: this.data.branchDiameter },
      { id: 3, ...rotate(c4_local), angle: (this.rotation + 90) % 360, diameter: this.data.branchDiameter }
    ];
  }

  getIntersectionPoints(): Point[] {
    return [{ x: this.x, y: this.y }];
  }

  isPointInside(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const rad = -this.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const inMain = Math.abs(localX) <= this.data.mainLength / 2 && Math.abs(localY) <= this.data.mainDiameter / 2;
    const inBranch = Math.abs(localY) <= this.data.branchLength / 2 && Math.abs(localX) <= this.data.branchDiameter / 2;

    return inMain || inBranch;
  }
}

export function createDuctPart(type: DuctPartType, data: Omit<IDuctPart<any>, 'type'>): DuctPart<any> {
  const fullData: IDuctPart<any> = { ...data, type };
  switch (type) {
    case DuctPartType.Straight:
      return new StraightDuctPart(fullData as IDuctPart<DuctPartType.Straight>);
    case DuctPartType.Elbow:
      return new ElbowDuctPart(fullData as IDuctPart<DuctPartType.Elbow>);
    case DuctPartType.Reducer:
      return new ReducerDuctPart(fullData as IDuctPart<DuctPartType.Reducer>);
    case DuctPartType.Branch:
      return new BranchDuctPart(fullData as IDuctPart<DuctPartType.Branch>);
    case DuctPartType.Cap:
      return new CapDuctPart(fullData as IDuctPart<DuctPartType.Cap>);
    case DuctPartType.Tee:
      return new TeeDuctPart(fullData as IDuctPart<DuctPartType.Tee>);
    default:
      throw new Error(`Unknown duct part type: ${type}`);
  }
}
