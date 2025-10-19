import { AnyDuctPart, DuctPart as IDuctPart, Point, StraightDuct as IStraightDuct, Elbow90 as IElbow90, AdjustableElbow as IAdjustableElbow, TeeReducer as ITeeReducer, YBranch as IYBranch, YBranchReducer as IYBranchReducer, Reducer as IReducer, Damper as IDamper, Connector, DuctType } from "./types";

abstract class DuctPart<T extends DuctType> implements IDuctPart<T> {
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

  constructor(data: Omit<IDuctPart<T>, 'type'>, type: T) {
    this.id = data.id;
    this.groupId = data.groupId;
    this.x = data.x;
    this.y = data.y;
    this.rotation = data.rotation;
    this.diameter = data.diameter;
    this.systemName = data.systemName;
    this.isSelected = data.isSelected;
    this.isFlipped = data.isFlipped;
    this.type = type;
  }

  abstract isPointInside(point: Point): boolean;
  abstract getConnectors(): Connector[];
}

export class StraightDuct extends DuctPart<'StraightDuct'> implements IStraightDuct {
  length: number;

  constructor(data: IStraightDuct) {
    super(data, 'StraightDuct');
    this.length = data.length;
  }

  isPointInside(point: Point): boolean {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    const rad = -this.rotation * Math.PI / 180;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    return Math.abs(localX) <= this.length / 2 && Math.abs(localY) <= this.diameter / 2;
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
}

export class Elbow90 extends DuctPart<'Elbow90'> implements IElbow90 {
    legLength: number;

    constructor(data: IElbow90) {
        super(data, 'Elbow90');
        this.legLength = data.legLength;
    }

    isPointInside(point: Point): boolean {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        const leg1 = (localX >= -this.diameter/2 && localX <= this.diameter/2 && localY >= 0 && localY <= this.legLength);
        const leg2 = (localY >= -this.diameter/2 && localY <= this.diameter/2 && localX >= 0 && localX <= this.legLength);
        
        return leg1 || leg2;
    }

    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const c1_local = { x: 0, y: this.legLength };
        const c2_local = { x: this.legLength, y: 0 };

        const rotate = (p: Point) => ({
            x: this.x + p.x * cos - p.y * sin,
            y: this.y + p.x * sin + p.y * cos
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 270) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter }
        ];
    }
}

export class AdjustableElbow extends DuctPart<'AdjustableElbow'> implements IAdjustableElbow {
    legLength: number;
    angle: number;

    constructor(data: IAdjustableElbow) {
        super(data, 'AdjustableElbow');
        this.legLength = data.legLength;
        this.angle = data.angle;
    }

    isPointInside(point: Point): boolean {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;

        const leg1_end = { x: this.legLength * Math.cos(-angleRad / 2), y: -this.legLength * Math.sin(-angleRad / 2) };
        const leg2_end = { x: this.legLength * Math.cos(angleRad / 2), y: -this.legLength * Math.sin(angleRad / 2) };

        const distToSegment = (p: Point, v: Point, w: Point) => {
            const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
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

    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;
        
        const c1_local = { 
            x: this.legLength * Math.cos(-angleRad / 2),
            y: -this.legLength * Math.sin(-angleRad / 2)
        };
        const c2_local = {
            x: this.legLength * Math.cos(angleRad / 2),
            y: -this.legLength * Math.sin(angleRad / 2)
        };

        const rotate = (p: Point) => ({
            x: this.x + p.x * Math.cos(rad) - p.y * Math.sin(rad),
            y: this.y + p.x * Math.sin(rad) + p.y * Math.cos(rad)
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180 + angle / 2) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: (this.rotation - angle / 2 + 360) % 360, diameter: this.diameter }
        ];
    }
}

export class TeeReducer extends DuctPart<'TeeReducer'> implements ITeeReducer {
    length: number;
    branchLength: number;
    diameter2: number;
    diameter3: number;
    intersectionOffset: number;

    constructor(data: ITeeReducer) {
        super(data, 'TeeReducer');
        this.length = data.length;
        this.branchLength = data.branchLength;
        this.diameter2 = data.diameter2;
        this.diameter3 = data.diameter3;
        this.intersectionOffset = data.intersectionOffset;
    }

    isPointInside(point: Point): boolean {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        const inMain = Math.abs(localY) <= this.diameter / 2 && Math.abs(localX) <= this.length / 2;
        
        const branchBottom = this.isFlipped ? 0 : -this.branchLength;
        const branchTop = this.isFlipped ? this.branchLength : 0;
        const inBranch = localY >= branchBottom && localY <= branchTop && Math.abs(localX - this.intersectionOffset) <= this.diameter3 / 2;

        return inMain || inBranch;
    }

    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const c1_local = { x: -this.length / 2, y: 0 };
        const c2_local = { x: this.length / 2, y: 0 };
        const c3_local = { x: this.intersectionOffset, y: this.isFlipped ? this.branchLength : -this.branchLength };
        const c3_angle = this.isFlipped ? (this.rotation + 90) % 360 : (this.rotation - 90 + 360) % 360;

        const rotate = (p: Point) => ({
            x: this.x + p.x * cos - p.y * sin,
            y: this.y + p.x * sin + p.y * cos
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter, type: 'main' },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter2, type: 'main' },
            { id: 2, ...rotate(c3_local), angle: c3_angle, diameter: this.diameter3, type: 'branch' }
        ];
    }
}

export class YBranch<T extends 'YBranch' | 'YBranchReducer'> extends DuctPart<T> implements IYBranch<T> {
    length: number;
    angle: number;
    branchLength: number;
    intersectionOffset: number;

    constructor(data: IYBranch<T>, type: T) {
        super(data, type);
        this.length = data.length;
        this.angle = data.angle;
        this.branchLength = data.branchLength;
        this.intersectionOffset = data.intersectionOffset;
    }

    isPointInside(point: Point): boolean {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
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
        
        const inBranch = (branchLocalX >= 0 && branchLocalX <= this.branchLength &&
                          branchLocalY >= -this.diameter / 2 && branchLocalY <= this.diameter / 2);

        return inMain || inBranch;
    }

    getConnectors(): Connector[] {
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
        
        const rotate = (p: Point) => ({
            x: this.x + p.x * cos_rad - p.y * sin_rad,
            y: this.y + p.x * sin_rad + p.y * cos_rad
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter, type: 'main' },
            { id: 1, ...rotate(c2_local), angle: this.rotation % 360, diameter: this.diameter, type: 'main' },
            { id: 2, ...rotate(c3_local), angle: (this.rotation - angle + 360) % 360, diameter: this.diameter, type: 'branch' }
        ];
    }
}

export class YBranchReducer extends YBranch<'YBranchReducer'> implements IYBranchReducer {
    diameter2: number;
    diameter3: number;

    constructor(data: IYBranchReducer) {
        super(data, 'YBranchReducer');
        this.diameter2 = data.diameter2;
        this.diameter3 = data.diameter3;
    }

    getConnectors(): Connector[] {
        const baseConnectors = super.getConnectors();
        baseConnectors[1].diameter = this.diameter2;
        baseConnectors[2].diameter = this.diameter3;
        return baseConnectors;
    }
}

export class Reducer extends DuctPart<'Reducer'> implements IReducer {
    length: number;
    diameter2: number;

    constructor(data: IReducer) {
        super(data, 'Reducer');
        this.length = data.length;
        this.diameter2 = data.diameter2;
    }

    isPointInside(point: Point): boolean {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
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

    getConnectors(): Connector[] {
        const rad = this.rotation * Math.PI / 180;
        const dx = Math.cos(rad) * this.length / 2;
        const dy = Math.sin(rad) * this.length / 2;
        return [
            { id: 0, x: this.x - dx, y: this.y - dy, angle: (this.rotation + 180) % 360, diameter: this.diameter },
            { id: 1, x: this.x + dx, y: this.y + dy, angle: this.rotation, diameter: this.diameter2 }
        ];
    }
}

export class Damper extends DuctPart<'Damper'> implements IDamper {
    length: number;

    constructor(data: IDamper) {
        super(data, 'Damper');
        this.length = data.length;
    }

    isPointInside(point: Point): boolean {
        const dx = point.x - this.x;
        const dy = point.y - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(localX) <= this.length / 2 && Math.abs(localY) <= this.diameter / 2;
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
}


// Factory function to create class instances from plain objects
export function createDuctPart(data: AnyDuctPart): DuctPart<DuctType> | null {
  switch (data.type) {
    case 'StraightDuct':
      return new StraightDuct(data);
    case 'Elbow90':
        return new Elbow90(data);
    case 'AdjustableElbow':
        return new AdjustableElbow(data);
    case 'TeeReducer':
        return new TeeReducer(data);
    case 'YBranch':
        return new YBranch(data as IYBranch<'YBranch'>, 'YBranch');
    case 'YBranchReducer':
        return new YBranchReducer(data as IYBranchReducer);
    case 'Reducer':
        return new Reducer(data);
    case 'Damper':
        return new Damper(data);
    default:
      return null;
  }
}
