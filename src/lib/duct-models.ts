import { AnyDuctPart, DuctPartType, Connector, IntersectionPoint, IDuctPart, Camera } from '@/lib/types';

const DIAMETER_COLORS: { [key: number]: string; default: string } = {
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

export interface DuctPartOptions {
    rotation?: number;
    diameter?: number;
    systemName?: string;
    isFlipped?: boolean;
    length?: number;
    legLength?: number;
    angle?: number;
    diameter2?: number;
    diameter3?: number;
    branchLength?: number;
    intersectionOffset?: number;
    type?: DuctPartType;
    mainLength?: number;
}

export abstract class DuctPart implements IDuctPart {
    id: number;
    groupId: number;
    x: number;
    y: number;
    rotation: number;
    diameter: number;
    systemName: string;
    isSelected: boolean;
    isFlipped: boolean;
    type: DuctPartType;
    name: string;

    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        this.id = 0;
        this.groupId = 0;
        this.x = x;
        this.y = y;
        this.rotation = options.rotation || 0;
        this.diameter = options.diameter || 100;
        this.systemName = options.systemName || 'SYS';
        this.isSelected = false;
        this.isFlipped = options.isFlipped || false;
        this.type = options.type!;
        this.name = '';
    }

    get color(): string { return getColorForDiameter(this.diameter); }
    abstract draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
    abstract drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void;
    abstract getConnectors(): Connector[];
    abstract isPointInside(px: number, py: number): boolean;
    getIntersectionPoints(): IntersectionPoint[] { return []; }
    rotate(): void { this.rotation = (this.rotation + 45) % 360; }
    flip(): void { this.isFlipped = !this.isFlipped; }
}

export class StraightDuct extends DuctPart {
    length: number;
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.Straight;
        this.length = options.length === undefined ? 400 : options.length;
    }
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        const width = this.length;
        const height = this.diameter;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.strokeRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
        }
        ctx.fillStyle = '#1e293b';
        ctx.font = `${18 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = `${this.systemName} D${this.diameter} L${Math.round(this.length)}`;
        const textMetrics = ctx.measureText(text);
        const angle = (this.rotation % 360 + 360) % 360;
        const isUpsideDown = angle > 90 && angle < 270;
        ctx.save();
        if (isUpsideDown) { ctx.rotate(Math.PI); }
        if (textMetrics.width > width - 20) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(60, height / 2 + 60);
            ctx.lineTo(textMetrics.width / 2 + 70, height / 2 + 60);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.fillText(text, 70, height / 2 + 60);
        } else {
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
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const dx = Math.cos(rad) * this.length / 2;
        const dy = Math.sin(rad) * this.length / 2;
        return [
            { id: 0, x: this.x - dx, y: this.y - dy, angle: (this.rotation + 180) % 360, diameter: this.diameter },
            { id: 1, x: this.x + dx, y: this.y + dy, angle: this.rotation, diameter: this.diameter }
        ];
    }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(localX) <= this.length / 2 && Math.abs(localY) <= this.diameter / 2;
    }
}



export class Elbow90 extends DuctPart {
    legLength: number;
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.Elbow90;
        this.legLength = options.legLength || 150;
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
        ctx.moveTo(0, this.legLength);
        ctx.lineTo(0, 0);
        ctx.lineTo(this.legLength, 0);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = this.diameter + 8;
            ctx.globalAlpha = 0.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(0, this.legLength);
            ctx.lineTo(0, 0);
            ctx.lineTo(this.legLength, 0);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const text = `D${this.diameter} L:${this.legLength}`;
        const angle1 = (this.rotation % 360 + 360) % 360;
        const isUpsideDown1 = angle1 > 90 && angle1 < 270;
        ctx.save();
        if (isUpsideDown1) { ctx.rotate(Math.PI); }
        ctx.fillText(text, this.legLength / 2, -this.diameter / 2 - 5);
        ctx.restore();
        const angle2 = ((this.rotation + 270) % 360 + 360) % 360;
        const isUpsideDown2 = angle2 > 90 && angle2 < 270;
        ctx.save();
        ctx.translate(0, this.legLength);
        ctx.rotate(-Math.PI / 2);
        if (isUpsideDown2) { ctx.rotate(Math.PI); }
        ctx.fillText(text, this.legLength / 2, -this.diameter / 2 - 5);
        ctx.restore();
        this.drawCenterline(ctx, camera);
        ctx.restore();
    }
    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(0, this.legLength);
        ctx.lineTo(0, 0);
        ctx.lineTo(this.legLength, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const c1_local = { x: 0, y: this.legLength };
        const c2_local = { x: this.legLength, y: 0 };
        const rotate = (p: { x: number; y: number }) => ({
            x: this.x + p.x * cos - p.y * sin,
            y: this.y + p.x * sin + p.y * cos
        });
        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 270) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter }
        ];
    }
    getIntersectionPoints(): IntersectionPoint[] { return [{ id: 'center', x: this.x, y: this.y }]; }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const leg1 = (localX >= -this.diameter / 2 && localX <= this.diameter / 2 && localY >= 0 && localY <= this.legLength);
        const leg2 = (localY >= -this.diameter / 2 && localY <= this.diameter / 2 && localX >= 0 && localX <= this.legLength);
        return leg1 || leg2;
    }
}

export class AdjustableElbow extends DuctPart {
    legLength: number;
    angle: number;
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.AdjustableElbow;
        this.legLength = options.legLength || 150;
        this.angle = options.angle || 60;
    }
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.diameter;
        ctx.lineCap = 'butt';
        this.drawLegs(ctx).stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1e293b';
        this.drawLegs(ctx).stroke();
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = this.diameter + 8;
            ctx.globalAlpha = 0.5;
            ctx.lineJoin = 'round';
            this.drawLegs(ctx).stroke();
            ctx.globalAlpha = 1;
        }
        this.drawCenterline(ctx, camera);
        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        const text = `D${this.diameter} L:${this.legLength}`;
        const currentAngle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = currentAngle * Math.PI / 180;
        const placeTextOnLeg = (legAngle: number) => {
            const worldAngleDeg = this.rotation + (legAngle * 180 / Math.PI);
            const effectiveAngle = (worldAngleDeg % 360 + 360) % 360;
            const isUpsideDown = effectiveAngle > 90 && effectiveAngle < 270;
            ctx.save();
            ctx.translate((this.legLength / 2) * Math.cos(legAngle), (this.legLength / 2) * Math.sin(legAngle));
            ctx.rotate(legAngle);
            if (isUpsideDown) { ctx.rotate(Math.PI); }
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, 0, -this.diameter / 2 - 5);
            ctx.restore();
        };
        placeTextOnLeg(-angleRad / 2);
        placeTextOnLeg(angleRad / 2);
        ctx.restore();
    }
    private drawLegs(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;
        const leg2X = this.legLength * Math.cos(angleRad / 2);
        const leg2Y = -this.legLength * Math.sin(angleRad / 2);
        const leg1X = this.legLength * Math.cos(-angleRad / 2);
        const leg1Y = -this.legLength * Math.sin(-angleRad / 2);
        ctx.beginPath();
        ctx.moveTo(leg1X, leg1Y);
        ctx.lineTo(0, 0);
        ctx.lineTo(leg2X, leg2Y);
        return ctx;
    }
    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.lineWidth = 1 / camera.zoom;
        ctx.strokeStyle = '#334155';
        this.drawLegs(ctx).stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;

        const c1_local = { 
            x: this.legLength * Math.cos(-angleRad / 2),
            y: this.legLength * Math.sin(-angleRad / 2) 
        };
        const c2_local = {
            x: this.legLength * Math.cos(angleRad / 2),
            y: this.legLength * Math.sin(angleRad / 2)
        };

        const rotate = (p: { x: number; y: number }) => ({ 
            x: this.x + p.x * Math.cos(rad) - p.y * Math.sin(rad), 
            y: this.y + p.x * Math.sin(rad) + p.y * Math.cos(rad) 
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180 - angle / 2) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: (this.rotation + angle / 2) % 360, diameter: this.diameter }
        ];
    }
    rotate(): void {
        const angle = this.isFlipped ? -this.angle : this.angle;
        const offset = angle / 2;
        const leg1Angle = (this.rotation - offset + 720) % 360;
        const k = Math.round(leg1Angle / 45);
        const nextLeg1Angle = ((k + 1) * 45) % 360;
        this.rotation = (nextLeg1Angle + offset + 360) % 360;
    }
    getIntersectionPoints(): IntersectionPoint[] { return [{ id: 'center', x: this.x, y: this.y }]; }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;
        const leg1_end = { x: this.legLength * Math.cos(-angleRad / 2), y: -this.legLength * Math.sin(-angleRad / 2) };
        const leg2_end = { x: this.legLength * Math.cos(angleRad / 2), y: -this.legLength * Math.sin(angleRad / 2) };
        const distToSegment = (p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) => {
            const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
            if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
            let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
            return Math.hypot(p.x - projection.x, p.y - projection.y);
        };
        const origin = { x: 0, y: 0 };
        const p_local = { x: localX, y: localY };
        const inLeg1 = distToSegment(p_local, origin, leg1_end) <= this.diameter / 2;
        const inLeg2 = distToSegment(p_local, origin, leg2_end) <= this.diameter / 2;
        return inLeg1 || inLeg2;
    }
}

export class TeeReducer extends DuctPart {
    length: number;
    branchLength: number;
    diameter2: number;
    diameter3: number;
    intersectionOffset: number;

    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.TeeReducer;
        this.length = options.length || 250;
        this.branchLength = options.branchLength || 150;
        this.diameter2 = options.diameter2 || this.diameter;
        this.diameter3 = options.diameter3 || 100;
        this.intersectionOffset = options.intersectionOffset || 0;
    }

    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        const branchY = this.isFlipped ? this.branchLength : -this.branchLength;
        const branchTextY = this.isFlipped ? this.branchLength / 2 : -this.branchLength / 2;
        const branchTextRot = this.isFlipped ? Math.PI / 2 : -Math.PI / 2;
        ctx.save();
        ctx.translate(this.intersectionOffset, 0);
        ctx.fillStyle = getColorForDiameter(this.diameter3);
        ctx.fillRect(-this.diameter3 / 2, 0, this.diameter3, branchY);
        ctx.strokeRect(-this.diameter3 / 2, 0, this.diameter3, branchY);
        ctx.restore();
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.length / 2, -this.diameter / 2, this.length, this.diameter);
        ctx.strokeRect(-this.length / 2, -this.diameter / 2, this.length, this.diameter);
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            const b = this.getBounds();
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        const mainAngle = (this.rotation % 360 + 360) % 360;
        const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;
        ctx.save();
        if (mainIsUpsideDown) { ctx.rotate(Math.PI); }
        const leftLength = this.length / 2 + this.intersectionOffset;
        const rightLength = this.length / 2 - this.intersectionOffset;
        const leftTextX = (-this.length / 2 + this.intersectionOffset) / 2;
        const rightTextX = (this.intersectionOffset + this.length / 2) / 2;
        ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
        ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, this.diameter / 2 + 5);
        ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, this.diameter / 2 + 5);
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter}-${this.diameter2}`, 0, 0);
        ctx.restore();
        const branchAngle = (this.rotation + (this.isFlipped ? 90 : 270)) % 360;
        const branchIsUpsideDown = ((branchAngle % 360 + 360) % 360 > 90 && (branchAngle % 360 + 360) % 360 < 270);
        ctx.save();
        ctx.translate(this.intersectionOffset, branchTextY);
        ctx.rotate(branchTextRot);
        if (branchIsUpsideDown) { ctx.rotate(Math.PI); }
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${this.diameter3} L:${this.branchLength}`, 0, -this.diameter3 / 2 - 5);
        ctx.restore();
        this.drawCenterline(ctx, camera);
        ctx.restore();
    }
    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        const branchY = this.isFlipped ? this.branchLength : -this.branchLength;
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.moveTo(this.intersectionOffset, 0);
        ctx.lineTo(this.intersectionOffset, branchY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    private getBounds(): { x: number; y: number; w: number; h: number } {
        const branchY = this.isFlipped ? 0 : -this.branchLength;
        const branchH = this.branchLength;
        const main = { x: -this.length / 2, y: -this.diameter / 2, w: this.length, h: this.diameter };
        const branch = { x: this.intersectionOffset - this.diameter3 / 2, y: branchY, w: this.diameter3, h: branchH };
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
        const c1_local = { x: -this.length / 2, y: 0 };
        const c2_local = { x: this.length / 2, y: 0 };
        const c3_local = { x: this.intersectionOffset, y: this.isFlipped ? this.branchLength : -this.branchLength };
        const c3_angle = this.isFlipped ? (this.rotation + 90) % 360 : (this.rotation - 90 + 360) % 360;
        const rotate = (p: { x: number; y: number }) => ({ x: this.x + p.x * cos - p.y * sin, y: this.y + p.x * sin + p.y * cos });
        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter, type: 'main' },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter2, type: 'main' },
            { id: 2, ...rotate(c3_local), angle: c3_angle, diameter: this.diameter3, type: 'branch' }
        ];
    }
    getIntersectionPoints(): IntersectionPoint[] {
        const rad = this.rotation * Math.PI / 180;
        const cos_rad = Math.cos(rad);
        const sin_rad = Math.sin(rad);
        const intersection_x = this.x + this.intersectionOffset * cos_rad;
        const intersection_y = this.y + this.intersectionOffset * sin_rad;
        return [{ id: 'center', x: intersection_x, y: intersection_y }];
    }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const inMain = Math.abs(localY) <= this.diameter / 2 && Math.abs(localX) <= this.length / 2;
        const branchBottom = this.isFlipped ? 0 : -this.branchLength;
        const branchTop = this.isFlipped ? this.branchLength : 0;
        const inBranch = localY >= branchBottom && localY <= branchTop && Math.abs(localX - this.intersectionOffset) <= this.diameter3 / 2;
        return inMain || inBranch;
    }
}



export class YBranch extends DuctPart {
    length: number;
    angle: number;
    branchLength: number;
    intersectionOffset: number;
    diameter2?: number;
    diameter3?: number;
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.YBranch;
        this.length = options.length || 300;
        this.angle = options.angle || 45;
        this.branchLength = options.branchLength || 150;
        this.intersectionOffset = options.intersectionOffset || 0;
        this.diameter2 = options.diameter2;
        this.diameter3 = options.diameter3;
    }
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);
        const branchDiameter = (this.type === DuctPartType.YBranchReducer) ? (this.diameter3 || this.diameter) : this.diameter;
        const branchColor = getColorForDiameter(branchDiameter);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        const angle = this.isFlipped ? -this.angle : this.angle;
        const branchAngleRad = -angle * Math.PI / 180;
        ctx.save();
        ctx.translate(this.intersectionOffset, 0);
        ctx.rotate(branchAngleRad);
        ctx.fillStyle = branchColor;
        ctx.fillRect(0, -branchDiameter / 2, this.branchLength, branchDiameter);
        ctx.strokeRect(0, -branchDiameter / 2, this.branchLength, branchDiameter);
        ctx.restore();
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.length / 2, -this.diameter / 2, this.length, this.diameter);
        ctx.strokeRect(-this.length / 2, -this.diameter / 2, this.length, this.diameter);
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            const maxD = Math.max(this.diameter, this.diameter2 || 0, this.diameter3 || 0);
            ctx.strokeRect(-this.length / 2 - 5, -maxD / 2 - 5, this.length + 10, maxD + 10);
        }
        this.drawCenterline(ctx, camera);
        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        const mainOutletDiameter = (this.type === DuctPartType.YBranchReducer) ? (this.diameter2 || this.diameter) : this.diameter;
        const mainAngle = (this.rotation % 360 + 360) % 360;
        const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;
        ctx.save();
        if (mainIsUpsideDown) { ctx.rotate(Math.PI); }
        const leftLength = this.length / 2 + this.intersectionOffset;
        const rightLength = this.length / 2 - this.intersectionOffset;
        const leftTextX = (-this.length / 2 + this.intersectionOffset) / 2;
        const rightTextX = (this.intersectionOffset + this.length / 2) / 2;
        ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
        ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, this.diameter / 2 + 5);
        ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, this.diameter / 2 + 5);
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter}-${mainOutletDiameter}`, 0, 0);
        ctx.restore();
        const branchWorldAngle = (this.rotation - angle + 360) % 360;
        const branchIsUpsideDown = branchWorldAngle > 90 && branchWorldAngle < 270;
        ctx.save();
        ctx.translate(this.intersectionOffset + (this.branchLength / 2) * Math.cos(branchAngleRad), (this.branchLength / 2) * Math.sin(branchAngleRad));
        ctx.rotate(branchAngleRad);
        if (branchIsUpsideDown) { ctx.rotate(Math.PI); }
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${branchDiameter} L:${this.branchLength}`, 0, -branchDiameter / 2 - 5);
        ctx.restore();
        ctx.restore();
    }
    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        const angle = this.isFlipped ? -this.angle : this.angle;
        const branchAngleRad = -angle * Math.PI / 180;
        const branchEndX = this.intersectionOffset + this.branchLength * Math.cos(branchAngleRad);
        const branchEndY = this.branchLength * Math.sin(branchAngleRad);
        ctx.moveTo(this.intersectionOffset, 0);
        ctx.lineTo(branchEndX, branchEndY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const cos_rad = Math.cos(rad);
        const sin_rad = Math.sin(rad);
        const angle = this.isFlipped ? -this.angle : this.angle;
        const c1_local = { x: -this.length / 2, y: 0 };
        const c2_local = { x: this.length / 2, y: 0 };
        const c3_local_unrotated = { x: this.branchLength * Math.cos(-angle * Math.PI / 180), y: this.branchLength * Math.sin(-angle * Math.PI / 180) };
        const c3_local = { x: this.intersectionOffset + c3_local_unrotated.x, y: c3_local_unrotated.y };
        const rotate = (p: { x: number; y: number }) => ({ x: this.x + p.x * cos_rad - p.y * sin_rad, y: this.y + p.x * sin_rad + p.y * cos_rad });
        const mainOutletDiameter = (this.type === DuctPartType.YBranchReducer) ? (this.diameter2 || this.diameter) : this.diameter;
        const branchOutletDiameter = (this.type === DuctPartType.YBranchReducer) ? (this.diameter3 || this.diameter) : this.diameter;
        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter, type: 'main' },
            { id: 1, ...rotate(c2_local), angle: this.rotation % 360, diameter: mainOutletDiameter, type: 'main' },
            { id: 2, ...rotate(c3_local), angle: (this.rotation - angle + 360) % 360, diameter: branchOutletDiameter, type: 'branch' }
        ];
    }
    getIntersectionPoints(): IntersectionPoint[] {
        const rad = this.rotation * Math.PI / 180;
        const cos_rad = Math.cos(rad);
        const sin_rad = Math.sin(rad);
        const intersection_x = this.x + this.intersectionOffset * cos_rad;
        const intersection_y = this.y + this.intersectionOffset * sin_rad;
        return [{ id: 'center', x: intersection_x, y: intersection_y }];
    }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const inMain = (localX >= -this.length / 2 && localX <= this.length / 2 && localY >= -this.diameter / 2 && localY <= this.diameter / 2);
        const angle = this.isFlipped ? -this.angle : this.angle;
        const branchAngleRad = -angle * Math.PI / 180;
        const branchCos = Math.cos(branchAngleRad);
        const branchSin = Math.sin(branchAngleRad);
        const relX = localX - this.intersectionOffset;
        const relY = localY;
        const branchLocalX = relX * branchCos + relY * branchSin;
        const branchLocalY = -relX * branchSin + relY * branchCos;
        const branchDiameter = (this.type === DuctPartType.YBranchReducer) ? (this.diameter3 || this.diameter) : this.diameter;
        const inBranch = (branchLocalX >= 0 && branchLocalX <= this.branchLength && branchLocalY >= -branchDiameter / 2 && branchLocalY <= branchDiameter / 2);
        return inMain || inBranch;
    }
}

export class YBranchReducer extends YBranch {
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.YBranchReducer;
        this.diameter2 = options.diameter2 || this.diameter;
        this.diameter3 = options.diameter3 || this.diameter;
    }
}

export class Reducer extends DuctPart {
    length: number;
    diameter2: number;
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.Reducer;
        this.length = options.length || 150;
        this.diameter2 = options.diameter2 || 100;
    }
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);
        const halfLen = this.length / 2;
        const d1_half = this.diameter / 2;
        const d2_half = this.diameter2 / 2;
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
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        const angle = (this.rotation % 360 + 360) % 360;
        const isUpsideDown = angle > 90 && angle < 270;
        ctx.save();
        if (isUpsideDown) { ctx.rotate(Math.PI); }
        ctx.fillText(`D${this.diameter}-${this.diameter2} L:${this.length}`, 0, Math.max(d1_half, d2_half) + 15);
        ctx.restore();
        this.drawCenterline(ctx, camera);
        ctx.restore();
    }
    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const dx = Math.cos(rad) * this.length / 2;
        const dy = Math.sin(rad) * this.length / 2;
        return [
            { id: 0, x: this.x - dx, y: this.y - dy, angle: (this.rotation + 180) % 360, diameter: this.diameter },
            { id: 1, x: this.x + dx, y: this.y + dy, angle: this.rotation, diameter: this.diameter2 }
        ];
    }
    flip(): void {
        [this.diameter, this.diameter2] = [this.diameter2, this.diameter];
    }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        const maxDiameter = Math.max(this.diameter, this.diameter2);
        if (Math.abs(localX) > this.length / 2 || Math.abs(localY) > maxDiameter / 2) { return false; }
        const slope = (this.diameter2 - this.diameter) / this.length;
        const expectedDiameterAtX = this.diameter + slope * (localX + this.length / 2);
        return Math.abs(localY) <= expectedDiameterAtX / 2;
    }
}

export class Damper extends DuctPart {
    length: number;
    constructor(x: number, y: number, options: DuctPartOptions = {}) {
        super(x, y, options);
        this.type = DuctPartType.Damper;
        this.length = options.length === undefined ? 100 : options.length;
    }
    get color(): string { return '#9ca3af'; }
    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);
        const width = this.length;
        const height = this.diameter;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeRect(-width / 2, -height / 2, width, height);
        ctx.beginPath();
        ctx.moveTo(-width / 2 + 5, 0);
        ctx.lineTo(width / 2 - 5, 0);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.stroke();
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.strokeRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
        }
        ctx.fillStyle = '#1e293b';
        ctx.font = `${18 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter} L${Math.round(this.length)}`, 0, 0);
        this.drawCenterline(ctx, camera);
        ctx.restore();
    }
    drawCenterline(ctx: CanvasRenderingContext2D, camera: Camera): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const dx = Math.cos(rad) * this.length / 2;
        const dy = Math.sin(rad) * this.length / 2;
        return [
            { id: 0, x: this.x - dx, y: this.y - dy, angle: (this.rotation + 180) % 360, diameter: this.diameter },
            { id: 1, x: this.x + dx, y: this.y + dy, angle: this.rotation, diameter: this.diameter }
        ];
    }
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(localX) <= this.length / 2 && Math.abs(localY) <= this.diameter / 2;
    }
}

export function createDuctPart(obj: AnyDuctPart): DuctPart | null {
    const options = { ...obj };
    let newObj: DuctPart | null = null;

    switch (obj.type) {
        case DuctPartType.Straight: newObj = new StraightDuct(obj.x, obj.y, options); break;
        case DuctPartType.Elbow90: newObj = new Elbow90(obj.x, obj.y, options); break;
        case DuctPartType.AdjustableElbow: newObj = new AdjustableElbow(obj.x, obj.y, options); break;
        case DuctPartType.TeeReducer: newObj = new TeeReducer(obj.x, obj.y, options); break;
        case DuctPartType.YBranch: newObj = new YBranch(obj.x, obj.y, options); break;
        case DuctPartType.YBranchReducer: newObj = new YBranchReducer(obj.x, obj.y, options); break;
        case DuctPartType.Reducer: newObj = new Reducer(obj.x, obj.y, options); break;
        case DuctPartType.Damper: newObj = new Damper(obj.x, obj.y, options); break;
        default: return null;
    }

    if (newObj) {
        newObj.id = obj.id;
        newObj.groupId = obj.groupId;
        newObj.isSelected = obj.isSelected;
        newObj.name = obj.name;
    }
    return newObj;
}