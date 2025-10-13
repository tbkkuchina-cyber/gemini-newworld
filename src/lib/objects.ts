// =================================================================================
// 色の定義
// =================================================================================
const DIAMETER_COLORS: { [key: number]: string } = {
    100: '#93c5fd',   // blue-300
    125: '#6ee7b7',   // emerald-300
    150: '#fde047',   // yellow-300
    175: '#fca5a5',   // red-300
    200: '#d8b4fe',   // purple-300
    250: '#fdba74',   // orange-300
};

function getColorForDiameter(diameter: number): string {
    return DIAMETER_COLORS[diameter] || '#60a5fa'; // blue-400
}

// =================================================================================
// オブジェクトクラス
// =================================================================================

export interface Bounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Point {
    x: number;
    y: number;
}

export class DimensionLine {
    id: string;
    p1: Point;
    p2: Point;
    value: number;
    isStraightRun: boolean;

    constructor(p1: Point, p2: Point, options: Partial<DimensionLine> = {}) {
        this.id = options.id || `dim-${Date.now()}`;
        this.p1 = p1;
        this.p2 = p2;
        this.value = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        this.isStraightRun = options.isStraightRun || false;
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }) {
        const color = this.isStraightRun ? 'rgba(239, 68, 68, 0.9)' : '#0284c7';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
    }
}

export class DuctPart {
    id: number;
    x: number;
    y: number;
    rotation: number;
    diameter: number;
    systemName: string;
    type: string = 'DuctPart';
    isSelected: boolean = false;
    isFlipped: boolean = false;
    groupId: number;

    constructor(id: number, x: number, y: number, options: Partial<DuctPart> = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.rotation = options.rotation || 0;
        this.diameter = options.diameter || 100;
        this.systemName = options.systemName || 'SYS';
        this.isSelected = options.isSelected || false;
        this.isFlipped = options.isFlipped || false;
        this.groupId = options.groupId || id;
    }

    get color(): string { return getColorForDiameter(this.diameter); }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void { /* Base class does not draw */ }
    
    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void { /* Base class does not draw */ }

    getConnectors(): { id: number; x: number; y: number; angle: number; diameter: number }[] { return []; }
    
    getIntersectionPoints(): { id: string; x: number; y: number }[] { return []; }

    isPointInside(px: number, py: number): boolean { return false; }

    rotate(): void { this.rotation = (this.rotation + 45) % 360; }

    flip(): void { this.isFlipped = !this.isFlipped; }
    
    clone(): DuctPart {
        return new DuctPart(this.id, this.x, this.y, this);
    }

    getBounds(): Bounds {
        return { x: -50, y: -50, w: 100, h: 100 };
    }
}

export class StraightDuct extends DuctPart {
    length: number;

    constructor(id: number, x: number, y: number, options: Partial<StraightDuct> = {}) {
        super(id, x, y, options);
        this.type = 'StraightDuct';
        this.length = options.length === undefined ? 400 : options.length;
    }

    getBounds(): Bounds {
        return { x: -this.length / 2, y: -this.diameter / 2, w: this.length, h: this.diameter };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);

        const { x, y, w, h } = this.getBounds();

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4 / camera.zoom;
            ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
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
        if (isUpsideDown) ctx.rotate(Math.PI);
        if (textMetrics.width > w - 20) {
            ctx.textAlign = 'left';
            ctx.fillText(text, 70 / camera.zoom, (h/2 + 70) / camera.zoom);
        } else {
            ctx.fillText(text, 0, 0);
        }
        ctx.restore();

        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    getConnectors() {
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

    clone(): StraightDuct {
        return new StraightDuct(this.id, this.x, this.y, this);
    }
}

export class Elbow90 extends DuctPart {
    legLength: number;

    constructor(id: number, x: number, y: number, options: Partial<Elbow90> = {}) {
        super(id, x, y, options);
        this.type = 'Elbow90';
        this.legLength = options.legLength || 100;
    }

    getBounds(): Bounds {
        return { x: 0, y: 0, w: this.legLength, h: this.legLength };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
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

        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();

        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = this.diameter + 8 / camera.zoom;
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
        const text = `D${this.diameter} L:${this.legLength}`;

        const angle1 = (this.rotation % 360 + 360) % 360;
        const isUpsideDown1 = angle1 > 90 && angle1 < 270;
        ctx.save();
        if (isUpsideDown1) ctx.rotate(Math.PI);
        ctx.textBaseline = isUpsideDown1 ? 'top' : 'bottom';
        ctx.fillText(text, this.legLength / 2, (isUpsideDown1 ? 1 : -1) * (this.diameter / 2 + 5 / camera.zoom));
        ctx.restore();
        
        const angle2 = ((this.rotation + 270) % 360 + 360) % 360;
        const isUpsideDown2 = angle2 > 90 && angle2 < 270;
        ctx.save();
        ctx.translate(0, this.legLength);
        ctx.rotate(-Math.PI / 2);
        if (isUpsideDown2) ctx.rotate(Math.PI);
        ctx.textBaseline = isUpsideDown2 ? 'top' : 'bottom';
        ctx.fillText(text, this.legLength / 2, (isUpsideDown2 ? 1 : -1) * (this.diameter / 2 + 5 / camera.zoom));
        ctx.restore();
        
        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
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
    
    getConnectors() {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const c1_local = { x: 0, y: this.legLength };
        const c2_local = { x: this.legLength, y: 0 };

        const rotate = (p: {x: number, y: number}) => ({
            x: this.x + p.x * cos - p.y * sin,
            y: this.y + p.x * sin + p.y * cos
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 270) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter }
        ];
    }
    
    getIntersectionPoints() {
        return [{ id: 'center', x: this.x, y: this.y }];
    }

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

    clone(): Elbow90 {
        return new Elbow90(this.id, this.x, this.y, this);
    }
}

export class AdjustableElbow extends DuctPart {
    legLength: number;
    angle: number;

    constructor(id: number, x: number, y: number, options: Partial<AdjustableElbow> = {}) {
        super(id, x, y, options);
        this.type = 'AdjustableElbow';
        this.legLength = options.legLength || 40;
        this.angle = options.angle || 135;
    }

    private getLegs(): { leg1: {x: number, y: number}, leg2: {x: number, y: number}} {
        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;
        const leg1 = { 
            x: this.legLength * Math.cos(-angleRad / 2),
            y: -this.legLength * Math.sin(-angleRad / 2)
        };
        const leg2 = { 
            x: this.legLength * Math.cos(angleRad / 2),
            y: -this.legLength * Math.sin(angleRad / 2)
        };
        return { leg1, leg2 };
    }

    getBounds(): Bounds {
        const { leg1, leg2 } = this.getLegs();
        const allPoints = [{x: 0, y: 0}, leg1, leg2];
        const minX = Math.min(...allPoints.map(p => p.x));
        const minY = Math.min(...allPoints.map(p => p.y));
        const maxX = Math.max(...allPoints.map(p => p.x));
        const maxY = Math.max(...allPoints.map(p => p.y));
        const padding = this.diameter / 2;
        return { x: minX - padding, y: minY - padding, w: (maxX - minX) + this.diameter, h: (maxY - minY) + this.diameter };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);
        
        const { leg1, leg2 } = this.getLegs();

        const drawLegsPath = () => {
            ctx.beginPath();
            ctx.moveTo(leg1.x, leg1.y);
            ctx.lineTo(0, 0);
            ctx.lineTo(leg2.x, leg2.y);
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.diameter;
        ctx.lineCap = 'butt';
        drawLegsPath();
        ctx.stroke();

        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeStyle = '#1e293b';
        drawLegsPath();
        ctx.stroke();

        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = this.diameter + 8 / camera.zoom;
            ctx.globalAlpha = 0.5;
            ctx.lineJoin = 'round';
            drawLegsPath();
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        
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
            if (isUpsideDown) ctx.rotate(Math.PI);
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, 0, -this.diameter / 2 - 5 / camera.zoom);
            ctx.restore();
        };
        placeTextOnLeg(-angleRad / 2);
        placeTextOnLeg(angleRad / 2);

        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        const { leg1, leg2 } = this.getLegs();
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(leg1.x, leg1.y);
        ctx.lineTo(0, 0);
        ctx.lineTo(leg2.x, leg2.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    getConnectors() {
        const rad = this.rotation * Math.PI / 180;
        const { leg1, leg2 } = this.getLegs();
        const angle = this.isFlipped ? -this.angle : this.angle;

        const rotate = (p: {x: number, y: number}) => ({
            x: this.x + p.x * Math.cos(rad) - p.y * Math.sin(rad),
            y: this.y + p.x * Math.sin(rad) + p.y * Math.cos(rad)
        });

        return [
            { id: 0, ...rotate(leg1), angle: (this.rotation + 180 + angle / 2) % 360, diameter: this.diameter },
            { id: 1, ...rotate(leg2), angle: (this.rotation - angle / 2 + 360) % 360, diameter: this.diameter }
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

    getIntersectionPoints() {
        return [{ id: 'center', x: this.x, y: this.y }];
    }

    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        const { leg1, leg2 } = this.getLegs();

        const distToSegment = (p: {x:number, y:number}, v: {x:number, y:number}, w: {x:number, y:number}) => {
            const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
            if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
            let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
            return Math.hypot(p.x - projection.x, p.y - projection.y);
        };

        const origin = { x: 0, y: 0 };
        const p_local = { x: localX, y: localY };

        const inLeg1 = distToSegment(p_local, origin, leg1) <= this.diameter / 2;
        const inLeg2 = distToSegment(p_local, origin, leg2) <= this.diameter / 2;
        
        return inLeg1 || inLeg2;
    }
}

export class TeeReducer extends DuctPart {
    length: number;
    branchLength: number;
    diameter2: number;
    diameter3: number;
    intersectionOffset: number;

    constructor(id: number, x: number, y: number, options: Partial<TeeReducer> = {}) {
        super(id, x, y, options);
        this.type = 'TeeReducer';
        this.length = options.length || 250;
        this.branchLength = options.branchLength || 120;
        this.diameter2 = options.diameter2 || this.diameter;
        this.diameter3 = options.diameter3 || 100;
        this.intersectionOffset = options.intersectionOffset || 0;
    }

    getBounds(): Bounds {
        const branchY = this.isFlipped ? 0 : -this.branchLength;
        const branchH = this.branchLength;
        
        const main = { x: -this.length/2, y: -this.diameter/2, w: this.length, h: this.diameter };
        const branch = { x: this.intersectionOffset - this.diameter3/2, y: branchY, w: this.diameter3, h: branchH };

        const minX = Math.min(main.x, branch.x);
        const minY = Math.min(main.y, branch.y);
        const maxX = Math.max(main.x + main.w, branch.x + branch.w);
        const maxY = Math.max(main.y + main.h, branch.y + branch.h);
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 / camera.zoom;
        
        const branchY = this.isFlipped ? this.branchLength : -this.branchLength;

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
            ctx.lineWidth = 4 / camera.zoom;
            const b = this.getBounds();
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        
        const mainAngle = (this.rotation % 360 + 360) % 360;
        const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;
        ctx.save();
        if (mainIsUpsideDown) ctx.rotate(Math.PI);
        const leftLength = this.length / 2 + this.intersectionOffset;
        const rightLength = this.length / 2 - this.intersectionOffset;
        const leftTextX = (-this.length / 2 + this.intersectionOffset) / 2;
        const rightTextX = (this.intersectionOffset + this.length / 2) / 2;
        ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
        ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, (mainIsUpsideDown ? -1 : 1) * (this.diameter / 2 + 5 / camera.zoom));
        ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, (mainIsUpsideDown ? -1 : 1) * (this.diameter / 2 + 5 / camera.zoom));
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter}-${this.diameter2}`, 0, 0);
        ctx.restore();
        
        const branchAngle = (this.rotation + (this.isFlipped ? 90 : 270)) % 360;
        const branchIsUpsideDown = ((branchAngle % 360 + 360) % 360 > 90 && (branchAngle % 360 + 360) % 360 < 270);
        ctx.save();
        ctx.translate(this.intersectionOffset, branchY / 2);
        ctx.rotate(this.isFlipped ? Math.PI / 2 : -Math.PI / 2);
        if (branchIsUpsideDown) ctx.rotate(Math.PI);
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${this.diameter3} L:${this.branchLength}`, 0, -this.diameter3 / 2 - 5 / camera.zoom);
        ctx.restore();

        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
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

    getConnectors() {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const c1_local = { x: -this.length / 2, y: 0 };
        const c2_local = { x: this.length / 2, y: 0 };
        const c3_local = { x: this.intersectionOffset, y: this.isFlipped ? this.branchLength : -this.branchLength };
        const c3_angle = this.isFlipped ? (this.rotation + 90) % 360 : (this.rotation - 90 + 360) % 360;

        const rotate = (p: {x: number, y: number}) => ({
            x: this.x + p.x * cos - p.y * sin,
            y: this.y + p.x * sin + p.y * cos
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter2 },
            { id: 2, ...rotate(c3_local), angle: c3_angle, diameter: this.diameter3 }
        ];
    }

    getIntersectionPoints() {
        const rad = this.rotation * Math.PI / 180;
        const intersection_x = this.x + this.intersectionOffset * Math.cos(rad);
        const intersection_y = this.y + this.intersectionOffset * Math.sin(rad);
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

export class Reducer extends DuctPart {
    length: number;
    diameter2: number;

    constructor(id: number, x: number, y: number, options: Partial<Reducer> = {}) {
        super(id, x, y, options);
        this.type = 'Reducer';
        this.length = options.length || 150;
        this.diameter2 = options.diameter2 || 100;
    }

    getBounds(): Bounds {
        const maxDiameter = Math.max(this.diameter, this.diameter2);
        return { x: -this.length / 2, y: -maxDiameter / 2, w: this.length, h: maxDiameter };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        const halfLen = this.length / 2;
        const d1_half = this.diameter / 2;
        const d2_half = this.diameter2 / 2;

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
        if (isUpsideDown) ctx.rotate(Math.PI);
        ctx.fillText(`D${this.diameter}-${this.diameter2} L:${this.length}`, 0, (isUpsideDown ? -1 : 1) * (Math.max(d1_half, d2_half) + 15 / camera.zoom));
        ctx.restore();

        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    getConnectors() {
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

        if (Math.abs(localX) > this.length / 2 || Math.abs(localY) > maxDiameter / 2) {
            return false;
        }

        const slope = (this.diameter2 - this.diameter) / this.length;
        const expectedDiameterAtX = this.diameter + slope * (localX + this.length / 2);
        
        return Math.abs(localY) <= expectedDiameterAtX / 2;
    }
}

export class YBranch extends DuctPart {
    length: number;
    angle: number;
    branchLength: number;
    intersectionOffset: number;

    constructor(id: number, x: number, y: number, options: Partial<YBranch> = {}) {
        super(id, x, y, options);
        this.type = 'YBranch';
        this.length = options.length || 350;
        this.angle = options.angle || 45;
        this.branchLength = options.branchLength || 200;
        this.intersectionOffset = options.intersectionOffset || 0;
    }

    getBounds(): Bounds {
        const angle = this.isFlipped ? -this.angle : this.angle;
        const branchAngleRad = -angle * Math.PI / 180;
        const branchEndX = this.intersectionOffset + this.branchLength * Math.cos(branchAngleRad);
        const branchEndY = this.branchLength * Math.sin(branchAngleRad);

        const mainMinX = -this.length / 2;
        const mainMaxX = this.length / 2;
        const mainMinY = -this.diameter / 2;
        const mainMaxY = this.diameter / 2;

        const minX = Math.min(mainMinX, this.intersectionOffset, branchEndX);
        const minY = Math.min(mainMinY, branchEndY);
        const maxX = Math.max(mainMaxX, branchEndX);
        const maxY = Math.max(mainMaxY, branchEndY);

        const padding = this.diameter / 2;
        return { x: minX - padding, y: minY - padding, w: (maxX - minX) + this.diameter, h: (maxY - minY) + this.diameter };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        const branchDiameter = ('diameter3' in this && (this as unknown as YBranchReducer).diameter3) || this.diameter;
        const branchColor = getColorForDiameter(branchDiameter);
        
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 / camera.zoom;

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
            ctx.lineWidth = 4 / camera.zoom;
            const b = this.getBounds();
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        }
        this.drawCenterline(ctx, camera);

        ctx.fillStyle = '#1e293b';
        ctx.font = `${16 / camera.zoom}px sans-serif`;
        const mainOutletDiameter = ('diameter2' in this && (this as unknown as YBranchReducer).diameter2) || this.diameter;
        const mainAngle = (this.rotation % 360 + 360) % 360;
        const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;
        ctx.save();
        if(mainIsUpsideDown) ctx.rotate(Math.PI);
        const leftLength = this.length / 2 + this.intersectionOffset;
        const rightLength = this.length / 2 - this.intersectionOffset;
        const leftTextX = (-this.length / 2 + this.intersectionOffset) / 2;
        const rightTextX = (this.intersectionOffset + this.length / 2) / 2;
        ctx.textBaseline = mainIsUpsideDown ? 'bottom' : 'top';
        ctx.fillText(`L:${leftLength.toFixed(1)}`, leftTextX, (mainIsUpsideDown ? -1 : 1) * (this.diameter / 2 + 5 / camera.zoom));
        ctx.fillText(`L:${rightLength.toFixed(1)}`, rightTextX, (mainIsUpsideDown ? -1 : 1) * (this.diameter / 2 + 5 / camera.zoom));
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter}-${mainOutletDiameter}`, 0, 0);
        ctx.restore();

        const branchWorldAngle = (this.rotation - angle + 360) % 360;
        const branchIsUpsideDown = branchWorldAngle > 90 && branchWorldAngle < 270;
        ctx.save();
        ctx.translate(this.intersectionOffset + (this.branchLength / 2) * Math.cos(branchAngleRad), (this.branchLength / 2) * Math.sin(branchAngleRad));
        ctx.rotate(branchAngleRad);
        if(branchIsUpsideDown) ctx.rotate(Math.PI);
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${branchDiameter} L:${this.branchLength}`, 0, -branchDiameter / 2 - 5 / camera.zoom);
        ctx.restore();

        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
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
    
    getConnectors() {
        const rad = this.rotation * Math.PI / 180;
        const cos_rad = Math.cos(rad);
        const sin_rad = Math.sin(rad);

        const angle = this.isFlipped ? -this.angle : this.angle;

        const c1_local = { x: -this.length / 2, y: 0 };
        const c2_local = { x: this.length / 2, y: 0 };
        const c3_local_unrotated = {
             x: this.branchLength * Math.cos(-angle * Math.PI / 180),
             y: this.branchLength * Math.sin(-angle * Math.PI / 180)
        };
        const c3_local = {
            x: this.intersectionOffset + c3_local_unrotated.x,
            y: c3_local_unrotated.y
        };
        
        const rotate = (p: {x: number, y: number}) => ({
            x: this.x + p.x * cos_rad - p.y * sin_rad,
            y: this.y + p.x * sin_rad + p.y * cos_rad
        });

        const mainOutletDiameter = ('diameter2' in this && (this as unknown as YBranchReducer).diameter2) || this.diameter;
        const branchOutletDiameter = ('diameter3' in this && (this as unknown as YBranchReducer).diameter3) || this.diameter;

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: this.rotation % 360, diameter: mainOutletDiameter },
            { id: 2, ...rotate(c3_local), angle: (this.rotation - angle + 360) % 360, diameter: branchOutletDiameter }
        ];
    }

    getIntersectionPoints() {
        const rad = this.rotation * Math.PI / 180;
        const intersection_x = this.x + this.intersectionOffset * Math.cos(rad);
        const intersection_y = this.y + this.intersectionOffset * Math.sin(rad);
        return [{ id: 'center', x: intersection_x, y: intersection_y }];
    }
    
    isPointInside(px: number, py: number): boolean {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        const inMain = (localX >= -this.length / 2 && localX <= this.length / 2 &&
                        localY >= -this.diameter / 2 && localY <= this.diameter / 2);

        const angle = this.isFlipped ? -this.angle : this.angle;
        const branchAngleRad = -angle * Math.PI / 180;
        const branchCos = Math.cos(branchAngleRad);
        const branchSin = Math.sin(branchAngleRad);

        const relX = localX - this.intersectionOffset;
        const relY = localY;

        const branchLocalX = relX * branchCos + relY * branchSin;
        const branchLocalY = -relX * branchSin + relY * branchCos;
        
        const branchDiameter = ('diameter3' in this && (this as unknown as YBranchReducer).diameter3) || this.diameter;

        const inBranch = (branchLocalX >= 0 && branchLocalX <= this.branchLength &&
                          branchLocalY >= -branchDiameter / 2 && branchLocalY <= branchDiameter / 2);

        return inMain || inBranch;
    }
}

export class YBranchReducer extends YBranch {
    diameter2: number;
    diameter3: number;

     constructor(id: number, x: number, y: number, options: Partial<YBranchReducer> = {}) {
        super(id, x, y, options);
        this.type = 'YBranchReducer';
        this.diameter2 = options.diameter2 || this.diameter;
        this.diameter3 = options.diameter3 || this.diameter;
    }
}

export class Damper extends DuctPart {
    length: number;

    constructor(id: number, x: number, y: number, options: Partial<Damper> = {}) {
        super(id, x, y, options);
        this.type = 'Damper';
        this.length = options.length === undefined ? 100 : options.length;
    }

    get color() { return '#9ca3af'; } // gray-400

    getBounds(): Bounds {
        return { x: -this.length / 2, y: -this.diameter / 2, w: this.length, h: this.diameter };
    }

    draw(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        const { x, y, w, h } = this.getBounds();

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);

        ctx.beginPath();
        ctx.moveTo(-this.length/2 + 5, 0);
        ctx.lineTo(this.length/2 - 5, 0);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.stroke();

        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4 / camera.zoom;
            ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = `${18 / camera.zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter} L${Math.round(this.length)}`, 0, 0);

        this.drawCenterline(ctx, camera);
        ctx.restore();
    }

    drawCenterline(ctx: CanvasRenderingContext2D, camera: { zoom: number }): void {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1 / camera.zoom;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    getConnectors() {
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
