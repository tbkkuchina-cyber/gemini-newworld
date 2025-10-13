// =================================================================================
// PWA化のためのコード (ManifestとService Worker)
// このセクションは、ウェブサイトをアプリのようにインストールして
// オフラインでも使えるようにするための設定です。
// =================================================================================
function setupPWA() {
    // 1. Web App Manifestを動的に生成・適用
    // アプリの名前、アイコン、起動時の画面設定などを定義します。
    const manifest = {
        "name": "簡易ダクト設計アプリ",
        "short_name": "ダクト設計",
        "start_url": ".",
        "display": "standalone",
        "background_color": "#f3f4f6",
        "theme_color": "#4f46e5",
        "description": "ブラウザで使える簡易的なダクト設計2Dアプリケーションです。",
        "icons": [
            {
                "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%234f46e5'/><path d='M25 30V50a10 10 0 0010 10h40' fill='none' stroke='%23fff' stroke-width='14' stroke-linecap='round' stroke-linejoin='round'/></svg>",
                "sizes": "192x192 512x512",
                "type": "image/svg+xml",
                "purpose": "any maskable"
            }
        ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);

    // 2. Service Workerを登録
    // Service Workerは、オフライン対応やプッシュ通知などの機能を実現します。
    if ('serviceWorker' in navigator) {
        // Service Workerのコードを文字列として定義
        const swCode = `
            const CACHE_NAME = 'duct-app-cache-v2'; // 更新時にキャッシュを区別するためバージョンを付けます
            const urlsToCache = [
                './' // アプリのメインページ
            ];

            // Service Worker インストール時
            self.addEventListener('install', event => {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            console.log('Cache opened');
                            // 基本的なファイルをキャッシュに追加
                            return cache.addAll(urlsToCache);
                        })
                );
            });

            // Service Worker アクティブ化時 (古いキャッシュの削除)
            self.addEventListener('activate', event => {
                event.waitUntil(
                    caches.keys().then(cacheNames => {
                        return Promise.all(
                            cacheNames.map(cacheName => {
                                if (cacheName !== CACHE_NAME) {
                                    console.log('Deleting old cache:', cacheName);
                                    return caches.delete(cacheName);
                                }
                            })
                        );
                    })
                );
                return self.clients.claim();
            });

            // Fetchイベント (ネットワークリクエスト) の処理
            self.addEventListener('fetch', event => {
                // GETリクエストのみをキャッシュ対象とする
                if (event.request.method !== 'GET') {
                    return;
                }

                event.respondWith(
                    caches.open(CACHE_NAME).then(cache => {
                        // 1. まずキャッシュを確認
                        return cache.match(event.request).then(response => {
                            // 2. キャッシュに存在すれば、それを返す (オフラインでも高速表示)
                            if (response) {
                                return response;
                            }

                            // 3. キャッシュになければ、ネットワークから取得
                            return fetch(event.request).then(networkResponse => {
                                // 4. 取得したレスポンスを次回の為にキャッシュに保存
                                // レスポンスは一度しか使えないので、クローンして保存用とブラウザ表示用に分ける
                                cache.put(event.request, networkResponse.clone());
                                
                                // 5. ネットワークからのレスポンスを返す
                                return networkResponse;
                            }).catch(error => {
                                // ネットワークエラー時 (オフラインなど)
                                console.error('Fetching failed:', error);
                                // ここでオフライン用の代替ページを返すことも可能
                            });
                        });
                    })
                );
            });
        `;

        const swBlob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(swBlob);

        window.addEventListener('load', () => {
            navigator.serviceWorker.register(swUrl)
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }
}

// PWAセットアップを実行
setupPWA();


// =================================================================================
// 初期設定とグローバル変数 (ここから下はアプリ本体のコード)
// =================================================================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoOverlay = document.getElementById('info-overlay');
const contextMenu = document.getElementById('context-menu');
const modal = document.getElementById('modal');

let objects = [];
let dimensions = [];
let nextId = 0;
let fittings = {};
let selectedObject = null;
let currentSnapPoint = null;

const camera = {
    x: 0,
    y: 0,
    zoom: 1 / (1.2 * 1.2) // デフォルトのズームレベルを調整
};
let currentZoom = camera.zoom; // 現在のズームレベルを追跡
let currentFontSize = 18 / camera.zoom; // 現在のフォントサイズ
let currentLineWidth = 1 / camera.zoom; // 現在の線幅
let currentFontSize16 = 16 / camera.zoom; // 基準フォントサイズ16px
const pan = {
    isPanning: false,
    startX: 0,
    startY: 0
};
const drag = {
    isDragging: false,
    target: null,
    offsetX: 0,
    offsetY: 0,
    initialPositions: new Map()
};
let mode = 'pan'; // 'pan', 'measure'
let measurePoints = [];

const CONNECT_DISTANCE = 50;
const DRAG_SNAP_DISTANCE = 20;

// History (Undo/Redo)
let history = [];
let historyIndex = -1;

// Touch Drag state
let touchDragState = {
    isDragging: false,
    item: null,
    type: '',
    ghostElement: null
};

// ピンチ操作の状態を管理するオブジェクト
const pinch = {
    isPinching: false,
    initialDist: 0
};

// =================================================================================
// 継手のデフォルトデータ
// =================================================================================
function getDefaultFittings() {
    return {
        '90°エルボ': [
            { id: 'elbow90-100', name: 'D100', diameter: 100, legLength: 100, visible: true },
        ],
        '45°エルボ': [
            { id: 'elbow45-100', name: 'D100', diameter: 100, legLength: 40, angle: 135, visible: true },
        ],
        'T字管レジューサー': [
            { id: 'teered-100-100-100', name: 'D100-100-100', diameter: 100, diameter2: 100, diameter3: 100, length: 250, branchLength: 150, intersectionOffset: 0, visible: true },
        ],
        'Y字管レジューサー': [
            { id: 'yred-100-100-100', name: 'D100-100-100', diameter: 100, diameter2: 100, diameter3: 100, angle: 45, length: 350, branchLength: 200, intersectionOffset: 0, visible: false },
        ],
        '可変角度エルボ': [
            { id: 'adjelbow-100-60', name: 'D100 60°', diameter: 100, legLength: 150, angle: 60, visible: false },
        ],
         'レジューサー': [
            { id: 'reducer-100-100', name: 'D100-100', diameter: 100, diameter2: 100, length: 150, visible: false },
        ],
        'ダンパー': [
            { id: 'damper-100-100', name: 'VD100 L100', diameter: 100, length: 100, visible: true },
        ],
    };
}


// =================================================================================
// 色の定義
// =================================================================================
const DIAMETER_COLORS = {
    default: '#60a5fa', // blue-400
    100: '#93c5fd',   // blue-300
    125: '#6ee7b7',   // emerald-300
    150: '#fde047',   // yellow-300
    175: '#fca5a5',   // red-300
    200: '#d8b4fe',   // purple-300
    250: '#fdba74',   // orange-300
};

function getColorForDiameter(diameter) {
    return DIAMETER_COLORS[diameter] || DIAMETER_COLORS.default;
}

// =================================================================================
// オブジェクトクラス
// =================================================================================
class DuctPart {
    constructor(x, y, options = {}) {
        this.id = nextId++;
        this.groupId = this.id;
        this.x = x;
        this.y = y;
        this.rotation = options.rotation || 0;
        this.diameter = options.diameter || 100;
        this.systemName = options.systemName || 'SYS';
        this.type = 'DuctPart';
        this.isSelected = false;
        this.isFlipped = options.isFlipped || false;
    }
    
    get color() { return getColorForDiameter(this.diameter); }
    
    draw(ctx) { /* Base class does not draw */ }
    drawCenterline(ctx) { /* Base class does not draw */ }
    getConnectors() { return []; }
    getIntersectionPoints() { return []; }
    isPointInside(px, py) { return false; }
    rotate() { this.rotation = (this.rotation + 45) % 360; }
    flip() { this.isFlipped = !this.isFlipped; }
}

class StraightDuct extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'StraightDuct';
        this.length = options.length === undefined ? 400 : options.length;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);

        const width = this.length;
        const height = this.diameter;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.fillRect(-width/2, -height/2, width, height);
        ctx.strokeRect(-width/2, -height/2, width, height);
        
        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.strokeRect(-width/2 - 5, -height/2 - 5, width + 10, height + 10);
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = `${currentFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = `${this.systemName} D${this.diameter} L${Math.round(this.length)}`;
        const textMetrics = ctx.measureText(text);

        const angle = (this.rotation % 360 + 360) % 360;
        const isUpsideDown = angle > 90 && angle < 270;

        ctx.save();
        if (isUpsideDown) {
            ctx.rotate(Math.PI);
        }

        if (textMetrics.width > width - 20) {
            // Draw with leader line if text is too wide for the duct
            ctx.beginPath();
            ctx.moveTo(0, 0); // Start line from center
            ctx.lineTo(60, height/2 + 60); // End line diagonally down-right
            ctx.lineTo(textMetrics.width / 2 + 70, height/2 + 60); // Horizontal part
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.fillText(text, 70, height/2 + 60);
        } else {
            // Draw text inside the duct
            ctx.fillText(text, 0, 0);
        }
        ctx.restore();


        this.drawCenterline(ctx);
        ctx.restore();
    }

    drawCenterline(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = currentLineWidth;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]); // ここはズームに応じて変化させる
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
    
    isPointInside(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(localX) <= this.length / 2 && Math.abs(localY) <= this.diameter / 2;
    }
}

class Elbow90 extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'Elbow90';
        this.legLength = options.legLength || 150;
    }

    draw(ctx) {
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
        ctx.font = `${currentFontSize16}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const text = `D${this.diameter} L:${this.legLength}`;

        // Text on horizontal leg
        const angle1 = (this.rotation % 360 + 360) % 360;
        const isUpsideDown1 = angle1 > 90 && angle1 < 270;
        ctx.save();
        if (isUpsideDown1) {
            ctx.rotate(Math.PI);
        }
        ctx.fillText(text, this.legLength / 2, -this.diameter / 2 - 5);
        ctx.restore();
        
        // Text on vertical leg
        const angle2 = ((this.rotation + 270) % 360 + 360) % 360;
        const isUpsideDown2 = angle2 > 90 && angle2 < 270;
        ctx.save();
        ctx.translate(0, this.legLength);
        ctx.rotate(-Math.PI / 2);
        if (isUpsideDown2) {
             ctx.rotate(Math.PI);
        }
        ctx.fillText(text, this.legLength / 2, -this.diameter / 2 - 5);
        ctx.restore();
        
        this.drawCenterline(ctx);
        ctx.restore();
    }

    drawCenterline(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = currentLineWidth;
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

        const rotate = (p) => ({
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

    isPointInside(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        
        const leg1 = (localX >= -this.diameter/2 && localX <= this.diameter/2 && localY >= 0 && localY <= this.legLength);
        const leg2 = (localY >= -this.diameter/2 && localY <= this.diameter/2 && localX >= 0 && localX <= this.legLength);
        
        return leg1 || leg2;
    }
}

class AdjustableElbow extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'AdjustableElbow';
        this.legLength = options.legLength || 150;
        this.angle = options.angle || 60;
    }

    draw(ctx) {
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
        
        this.drawCenterline(ctx);
        
        // Add text
        ctx.fillStyle = '#1e293b';
        ctx.font = `${currentFontSize16}px sans-serif`;
        ctx.textAlign = 'center';
        const text = `D${this.diameter} L:${this.legLength}`;
        const currentAngle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = currentAngle * Math.PI / 180;

        // Draw text on both legs for all adjustable elbows
        const placeTextOnLeg = (legAngle) => { // legAngle is local angle in radians
            const worldAngleDeg = this.rotation + (legAngle * 180 / Math.PI);
            const effectiveAngle = (worldAngleDeg % 360 + 360) % 360;
            const isUpsideDown = effectiveAngle > 90 && effectiveAngle < 270;

            ctx.save();
            ctx.translate((this.legLength / 2) * Math.cos(legAngle), (this.legLength / 2) * Math.sin(legAngle));
            ctx.rotate(legAngle);
            if (isUpsideDown) {
                ctx.rotate(Math.PI);
            }
            ctx.textBaseline = 'bottom';
            ctx.fillText(text, 0, -this.diameter / 2 - 5);
            ctx.restore();
        };

        placeTextOnLeg(-angleRad / 2);
        placeTextOnLeg(angleRad / 2);
        
        ctx.restore();
    }

    drawLegs(ctx) {
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

    drawCenterline(ctx) {
        ctx.save();
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.lineWidth = currentLineWidth;
        ctx.strokeStyle = '#334155';
        this.drawLegs(ctx).stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    getConnectors() {
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

        const rotate = (p) => ({
            x: this.x + p.x * Math.cos(rad) - p.y * Math.sin(rad),
            y: this.y + p.x * Math.sin(rad) + p.y * Math.cos(rad)
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180 + angle / 2) % 360, diameter: this.diameter },
            { id: 1, ...rotate(c2_local), angle: (this.rotation - angle / 2 + 360) % 360, diameter: this.diameter }
        ];
    }
    
    rotate() {
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

    isPointInside(px, py) {
        // INFO: Bug Fix: Selection accuracy was poor due to using a simple circular check.
        // This has been replaced with a precise point-to-line-segment distance check for each leg of the elbow.
        // 1. Transform the clicked point into the object's local coordinate system.
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        const angle = this.isFlipped ? -this.angle : this.angle;
        const angleRad = angle * Math.PI / 180;

        // 2. Define the centerlines of the two legs as vectors from the origin (0,0).
        const leg1_end = {
            x: this.legLength * Math.cos(-angleRad / 2),
            y: -this.legLength * Math.sin(-angleRad / 2)
        };
        const leg2_end = {
            x: this.legLength * Math.cos(angleRad / 2),
            y: -this.legLength * Math.sin(angleRad / 2)
        };

        // 3. Helper function to calculate the shortest distance from a point to a line segment.
        const distToSegment = (p, v, w) => {
            const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
            if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
            let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
            return Math.hypot(p.x - projection.x, p.y - projection.y);
        };

        const origin = { x: 0, y: 0 };
        const p_local = { x: localX, y: localY };

        // 4. Check if the distance to either leg segment is within half the diameter.
        const inLeg1 = distToSegment(p_local, origin, leg1_end) <= this.diameter / 2;
        const inLeg2 = distToSegment(p_local, origin, leg2_end) <= this.diameter / 2;
        
        return inLeg1 || inLeg2;
    }
}

class TeeReducer extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'TeeReducer';
        this.length = options.length || 250;
        this.branchLength = options.branchLength || 150;
        this.diameter2 = options.diameter2 || this.diameter; // Main outlet
        this.diameter3 = options.diameter3 || 100; // Branch
        this.intersectionOffset = options.intersectionOffset || 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        
        const branchY = this.isFlipped ? this.branchLength : -this.branchLength;
        const branchTextY = this.isFlipped ? this.branchLength / 2 : -this.branchLength / 2;
        const branchTextRot = this.isFlipped ? Math.PI / 2 : -Math.PI / 2;

        // Apply intersection offset for branch
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
        ctx.font = `${currentFontSize16}px sans-serif`;
        ctx.textAlign = 'center';
        
        // Main pipe text
        const mainAngle = (this.rotation % 360 + 360) % 360;
        const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;

        ctx.save();
        if (mainIsUpsideDown) {
            ctx.rotate(Math.PI);
        }
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
        
        // Branch pipe text
        const branchAngle = (this.rotation + (this.isFlipped ? 90 : 270)) % 360;
        const branchIsUpsideDown = ((branchAngle % 360 + 360) % 360 > 90 && (branchAngle % 360 + 360) % 360 < 270);
        
        ctx.save();
        ctx.translate(this.intersectionOffset, branchTextY);
        ctx.rotate(branchTextRot);
        if (branchIsUpsideDown) {
            ctx.rotate(Math.PI);
        }
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${this.diameter3} L:${this.branchLength}`, 0, -this.diameter3 / 2 - 5);
        ctx.restore();

        this.drawCenterline(ctx);
        ctx.restore();
    }

    drawCenterline(ctx) {
        const branchY = this.isFlipped ? this.branchLength : -this.branchLength;
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = currentLineWidth;
        ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.moveTo(this.intersectionOffset, 0);
        ctx.lineTo(this.intersectionOffset, branchY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    getBounds() {
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

    getConnectors() {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const c1_local = { x: -this.length / 2, y: 0 };
        const c2_local = { x: this.length / 2, y: 0 };
        const c3_local = { x: this.intersectionOffset, y: this.isFlipped ? this.branchLength : -this.branchLength };
        const c3_angle = this.isFlipped ? (this.rotation + 90) % 360 : (this.rotation - 90 + 360) % 360;


        const rotate = (p) => ({
            x: this.x + p.x * cos - p.y * sin,
            y: this.y + p.x * sin + p.y * cos
        });

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter, type: 'main' },
            { id: 1, ...rotate(c2_local), angle: this.rotation, diameter: this.diameter2, type: 'main' },
            { id: 2, ...rotate(c3_local), angle: c3_angle, diameter: this.diameter3, type: 'branch' }
        ];
    }

    getIntersectionPoints() {
        const rad = this.rotation * Math.PI / 180;
        const cos_rad = Math.cos(rad);
        const sin_rad = Math.sin(rad);
        const intersection_x = this.x + this.intersectionOffset * cos_rad;
        const intersection_y = this.y + this.intersectionOffset * sin_rad;
        return [{ id: 'center', x: intersection_x, y: intersection_y }];
    }

    isPointInside(px, py) {
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

class YBranch extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'YBranch';
        this.length = options.length || 300;
        this.angle = options.angle || 45;
        this.branchLength = options.branchLength || 150;
        this.intersectionOffset = options.intersectionOffset || 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        const branchDiameter = (this.type === 'YBranchReducer') ? this.diameter3 : this.diameter;
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
            // Simplified bounds for selection
            const maxD = Math.max(this.diameter, this.diameter2 || 0, this.diameter3 || 0);
            ctx.strokeRect(-this.length/2 - 5, -maxD/2 - 5, this.length + 10, maxD + 10);

        }
        this.drawCenterline(ctx);

        // Add text
        ctx.fillStyle = '#1e293b';
        ctx.font = `${currentFontSize16}px sans-serif`;
        ctx.textAlign = 'center';
        
        // Main pipe text
        const mainOutletDiameter = (this.type === 'YBranchReducer') ? this.diameter2 : this.diameter;
        const mainAngle = (this.rotation % 360 + 360) % 360;
        const mainIsUpsideDown = mainAngle > 90 && mainAngle < 270;

        ctx.save();
        if(mainIsUpsideDown) {
             ctx.rotate(Math.PI);
        }
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


        // Branch pipe text
        const branchWorldAngle = (this.rotation - angle + 360) % 360;
        const branchIsUpsideDown = branchWorldAngle > 90 && branchWorldAngle < 270;

        ctx.save();
        ctx.translate(this.intersectionOffset + (this.branchLength / 2) * Math.cos(branchAngleRad), (this.branchLength / 2) * Math.sin(branchAngleRad));
        ctx.rotate(branchAngleRad);
        if(branchIsUpsideDown) {
            ctx.rotate(Math.PI);
        }
        ctx.textBaseline = 'bottom';
        ctx.fillText(`D${branchDiameter} L:${this.branchLength}`, 0, -branchDiameter / 2 - 5);
        ctx.restore();

        ctx.restore();
    }

    drawCenterline(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = currentLineWidth;
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
        
        const rotate = (p) => ({
            x: this.x + p.x * cos_rad - p.y * sin_rad,
            y: this.y + p.x * sin_rad + p.y * cos_rad
        });

        const mainOutletDiameter = (this.type === 'YBranchReducer') ? this.diameter2 : this.diameter;
        const branchOutletDiameter = (this.type === 'YBranchReducer') ? this.diameter3 : this.diameter;

        return [
            { id: 0, ...rotate(c1_local), angle: (this.rotation + 180) % 360, diameter: this.diameter, type: 'main' },
            { id: 1, ...rotate(c2_local), angle: this.rotation % 360, diameter: mainOutletDiameter, type: 'main' },
            { id: 2, ...rotate(c3_local), angle: (this.rotation - angle + 360) % 360, diameter: branchOutletDiameter, type: 'branch' }
        ];
    }

    getIntersectionPoints() {
        const rad = this.rotation * Math.PI / 180;
        const cos_rad = Math.cos(rad);
        const sin_rad = Math.sin(rad);
        const intersection_x = this.x + this.intersectionOffset * cos_rad;
        const intersection_y = this.y + this.intersectionOffset * sin_rad;
        return [{ id: 'center', x: intersection_x, y: intersection_y }];
    }
    
    isPointInside(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        // Check main pipe
        const inMain = (localX >= -this.length / 2 && localX <= this.length / 2 &&
                        localY >= -this.diameter / 2 && localY <= this.diameter / 2);

        // Check branch pipe
        const angle = this.isFlipped ? -this.angle : this.angle;
        const branchAngleRad = -angle * Math.PI / 180;
        const branchCos = Math.cos(branchAngleRad);
        const branchSin = Math.sin(branchAngleRad);

        // Transform point relative to branch start
        const relX = localX - this.intersectionOffset;
        const relY = localY;

        // Rotate point to align with branch
        const branchLocalX = relX * branchCos + relY * branchSin;
        const branchLocalY = -relX * branchSin + relY * branchCos;
        
        const branchDiameter = (this.type === 'YBranchReducer') ? this.diameter3 : this.diameter;

        const inBranch = (branchLocalX >= 0 && branchLocalX <= this.branchLength &&
                          branchLocalY >= -branchDiameter / 2 && branchLocalY <= branchDiameter / 2);

        return inMain || inBranch;
    }
}

class YBranchReducer extends YBranch {
     constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'YBranchReducer';
        this.diameter2 = options.diameter2 || this.diameter;
        this.diameter3 = options.diameter3 || this.diameter;
    }
}

class Reducer extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'Reducer';
        this.length = options.length || 150;
        this.diameter2 = options.diameter2 || 100;
    }

    draw(ctx) {
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
        ctx.font = `${currentFontSize16}px sans-serif`;
        ctx.textAlign = 'center';
        
        const angle = (this.rotation % 360 + 360) % 360;
        const isUpsideDown = angle > 90 && angle < 270;
        
        ctx.save();
        if (isUpsideDown) {
            ctx.rotate(Math.PI);
        }
        ctx.fillText(`D${this.diameter}-${this.diameter2} L:${this.length}`, 0, Math.max(d1_half, d2_half) + 15);
        ctx.restore();

        this.drawCenterline(ctx);
        ctx.restore();
    }

    drawCenterline(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = currentLineWidth;
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
    
    flip() {
        [this.diameter, this.diameter2] = [this.diameter2, this.diameter];
    }
    
    isPointInside(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        const maxDiameter = Math.max(this.diameter, this.diameter2);

        if (Math.abs(localX) > this.length / 2 || Math.abs(localY) > maxDiameter / 2) {
            return false;
        }

        // Calculate the expected half-diameter at localX
        const slope = (this.diameter2 - this.diameter) / this.length;
        const expectedDiameterAtX = this.diameter + slope * (localX + this.length / 2);
        
        return Math.abs(localY) <= expectedDiameterAtX / 2;
    }
}

class Damper extends DuctPart {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.type = 'Damper';
        this.length = options.length === undefined ? 100 : options.length; // Default length for damper
        this.diameter = options.diameter || 100; // Default diameter for damper
    }

    get color() { return '#9ca3af'; } // Distinct gray for dampers

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.setLineDash([]);

        const width = this.length;
        const height = this.diameter;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.fillRect(-width/2, -height/2, width, height);
        ctx.strokeRect(-width/2, -height/2, width, height);

        // Draw damper blades
        ctx.beginPath();
        ctx.moveTo(-width/2 + 5, 0);
        ctx.lineTo(width/2 - 5, 0);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (this.isSelected) {
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 4;
            ctx.strokeRect(-width/2 - 5, -height/2 - 5, width + 10, height + 10);
        }

        ctx.fillStyle = '#1e293b';
        ctx.font = `${currentFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`D${this.diameter} L${Math.round(this.length)}`, 0, 0);

        this.drawCenterline(ctx);
        ctx.restore();
    }

    drawCenterline(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = currentLineWidth;
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
    
    isPointInside(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
        return Math.abs(localX) <= this.length / 2 && Math.abs(localY) <= this.diameter / 2;
    }
}

// =================================================================================
// History (Undo/Redo) Management
// =================================================================================
function deepCopyObjects(objArray) {
    return objArray.map(obj => {
        const options = { ...obj };
        let newObj;
        switch (obj.type) {
            case 'StraightDuct': newObj = new StraightDuct(obj.x, obj.y, options); break;
            case 'Elbow90': newObj = new Elbow90(obj.x, obj.y, options); break;
            case 'AdjustableElbow': newObj = new AdjustableElbow(obj.x, obj.y, options); break;
            case 'TeeReducer': newObj = new TeeReducer(obj.x, obj.y, options); break;
            case 'YBranch': newObj = new YBranch(obj.x, obj.y, options); break;
            case 'YBranchReducer': newObj = new YBranchReducer(obj.x, obj.y, options); break;
            case 'Reducer': newObj = new Reducer(obj.x, obj.y, options); break;
            case 'Damper': newObj = new Damper(obj.x, obj.y, options); break;
            default: return null;
        }
        newObj.id = obj.id;
        newObj.groupId = obj.groupId;
        newObj.isSelected = obj.isSelected;
        return newObj;
    }).filter(Boolean);
}

function saveState() {
    history.splice(historyIndex + 1);
    history.push({ 
        objects: deepCopyObjects(objects),
        dimensions: JSON.parse(JSON.stringify(dimensions))
    });
    historyIndex++;
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const state = history[historyIndex];
        objects = deepCopyObjects(state.objects);
        dimensions = JSON.parse(JSON.stringify(state.dimensions));
        selectedObject = null;
        hideContextMenu();
        updateUndoRedoButtons();
        draw();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        const state = history[historyIndex];
        objects = deepCopyObjects(state.objects);
        dimensions = JSON.parse(JSON.stringify(state.dimensions));
        selectedObject = null;
        hideContextMenu();
        updateUndoRedoButtons();
        draw();
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undo-btn').disabled = historyIndex <= 0;
    document.getElementById('redo-btn').disabled = historyIndex >= history.length - 1;
}

// =================================================================================
// Grouping & Connection
// =================================================================================
function recalculateGroups(objectList) {
    const visited = new Set();
    for (const obj of objectList) {
        if (!visited.has(obj.id)) {
            const newGroupId = obj.id;
            const queue = [obj];
            visited.add(obj.id);
            obj.groupId = newGroupId;

            while (queue.length > 0) {
                const currentObj = queue.shift();
                
                for (const neighbor of objectList) {
                    if (!visited.has(neighbor.id)) {
                        for (const c1 of currentObj.getConnectors()) {
                            for (const c2 of neighbor.getConnectors()) {
                                if (c1.diameter === c2.diameter && Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1) {
                                    visited.add(neighbor.id);
                                    neighbor.groupId = newGroupId;
                                    queue.push(neighbor);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}


// =================================================================================
// 計測スナップヘルパー
// =================================================================================
function findSnapPoint(worldPos) {
    const snapDistSq = (DRAG_SNAP_DISTANCE / camera.zoom)**2;
    let candidates = [];

    // Find all potential snap points within range
    for (const obj of objects) {
        const points = [...obj.getConnectors(), ...obj.getIntersectionPoints()];
        for (const p of points) {
            const distSq = (worldPos.x - p.x)**2 + (worldPos.y - p.y)**2;
            if (distSq < snapDistSq) {
                 candidates.push({
                    distSq: distSq,
                    point: { x: p.x, y: p.y },
                    object: obj,
                    pointId: p.id,
                    pointType: obj.getConnectors().some(c => c.id === p.id) ? 'connector' : 'intersection'
                });
            }
        }
    }

    if (candidates.length === 0) return null;

    // Sort candidates by distance
    candidates.sort((a, b) => a.distSq - b.distSq);
    
    const closestDistSq = candidates[0].distSq;

    // Filter for all candidates that are equally close (within a small tolerance)
    const closestCandidates = candidates.filter(c => c.distSq <= closestDistSq + 0.01);

    // From the closest candidates, prefer a fitting over a straight duct
    let bestCandidate = closestCandidates.find(c => c.object.type !== 'StraightDuct');
    
    // If no fitting is among the closest, just take the first one (which could be a straight duct)
    if (!bestCandidate) {
        bestCandidate = closestCandidates[0];
    }
    
    delete bestCandidate.distSq;
    return bestCandidate;
}

// =================================================================================
// キャンバスの描画と操作
// =================================================================================
function resizeCanvas() {
    // Canvasの表示サイズをCanvasの描画サイズに設定
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    draw();
}

function updateStraightRunDimensions() {
    // Remove old run dimensions to recalculate every frame, but keep user-created ones.
    const userDimensions = dimensions.filter(d => !d.isStraightRun);

    const straightDucts = objects.filter(o => o.type === 'StraightDuct');
    if (straightDucts.length < 2) {
        dimensions = userDimensions; // Ensure no old run dimensions are left
        return;
    }

    const adj = new Map();
    straightDucts.forEach(duct => adj.set(duct.id, []));

    // 1. Build adjacency list for straight ducts only
    for (let i = 0; i < straightDucts.length; i++) {
        for (let j = i + 1; j < straightDucts.length; j++) {
            const d1 = straightDucts[i];
            const d2 = straightDucts[j];
            if (d1.getConnectors().some(c1 => d2.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1))) {
                adj.get(d1.id).push(d2.id);
                adj.get(d2.id).push(d1.id);
            }
        }
    }

    const visited = new Set();
    const newRunDimensions = [];

    for (const duct of straightDucts) {
        if (visited.has(duct.id)) continue;

        const componentIds = [];
        const queue = [duct.id];
        visited.add(duct.id);

        while (queue.length > 0) {
            const currentId = queue.shift();
            componentIds.push(currentId);
            for (const neighborId of adj.get(currentId)) {
                if (!visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }

        if (componentIds.length < 2) continue; // We only care about runs of 2 or more

        const componentObjects = componentIds.map(id => straightDucts.find(d => d.id === id));
        const endPoints = [];

        for (const ductInComponent of componentObjects) {
            for (const connector of ductInComponent.getConnectors()) {
                // A connector is an end if it doesn't connect to another duct IN THIS COMPONENT
                const isConnectedToComponentDuct = componentObjects.some(otherDuct => {
                    if (ductInComponent.id === otherDuct.id) return false;
                    return otherDuct.getConnectors().some(otherConnector => Math.hypot(connector.x - otherConnector.x, connector.y - otherConnector.y) < 1);
                });

                if (!isConnectedToComponentDuct) {
                    // This connector is an end of the run. Find the object it's actually connected to (e.g., an elbow).
                    const connectedFitting = objects.find(o => o.type !== 'StraightDuct' && o.getConnectors().some(c => Math.hypot(c.x - connector.x, c.y - connector.y) < 1));
                    const endObject = connectedFitting || ductInComponent;
                    const endPointInfo = connectedFitting 
                        ? { ...endObject.getConnectors().find(c => Math.hypot(c.x - connector.x, c.y - connector.y) < 1), objId: endObject.id, pointType: 'connector' } 
                        : { ...connector, objId: endObject.id, pointType: 'connector' };

                    endPoints.push(endPointInfo);
                }
            }
        }
        
        if (endPoints.length === 2) {
            const [p1_info, p2_info] = endPoints;
            const distance = Math.hypot(p2_info.x - p1_info.x, p1_info.y - p1_info.y);

            const newDim = {
                p1_objId: p1_info.objId, p1_pointId: p1_info.id, p1_pointType: p1_info.pointType,
                p2_objId: p2_info.objId, p2_pointId: p2_info.id, p2_pointType: p2_info.pointType,
                value: distance,
                isStraightRun: true, // The special flag
                id: `run-${componentIds.sort().join('-')}` // A stable ID for the run
            };
            
            newRunDimensions.push(newDim);
        }
    }
    dimensions = [...userDimensions, ...newRunDimensions];
}

function draw() {
                    // ズームレベルが変更された場合のみ、フォントサイズと線幅を更新
                    if (currentZoom !== camera.zoom) {
                        currentFontSize = 18 / camera.zoom; // 基準フォントサイズ18px
                        currentLineWidth = 1 / camera.zoom; // 基準線幅1px
                        currentFontSize16 = 16 / camera.zoom; // 基準フォントサイズ16px
                        currentZoom = camera.zoom;
                    }    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-canvas.width / 2 + camera.x, -canvas.height / 2 + camera.y);

    drawGrid();
    objects.forEach(obj => obj.draw(ctx));
    drawAllSnapPoints(); // Draw snap points on top of objects
    updateStraightRunDimensions();
    drawDimensions();
    if (mode === 'measure') drawMeasureTool();
    if (drag.isDragging) drawConnectorsForDrag();

    ctx.restore();
}

function drawGrid() {
    const gridSize = 50 * camera.zoom;
    const xOffset = (camera.x * camera.zoom) % gridSize;
    const yOffset = (camera.y * camera.zoom) % gridSize;
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = currentLineWidth;
    for (let x = -xOffset; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x/camera.zoom - camera.x + canvas.width/2 , -camera.y + canvas.height/2);
        ctx.lineTo(x/camera.zoom - camera.x + canvas.width/2, canvas.height/camera.zoom - camera.y + canvas.height/2);
        ctx.stroke();
    }
    for (let y = -yOffset; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-camera.x + canvas.width/2, y/camera.zoom - camera.y + canvas.height/2);
        ctx.lineTo(canvas.width/camera.zoom - camera.x + canvas.width/2, y/camera.zoom - camera.y + canvas.height/2);
        ctx.stroke();
    }
}

function drawAllSnapPoints() {
    ctx.save();
    const radius = 8 / camera.zoom;
    const rectSize = 12 / camera.zoom;

            objects.forEach(obj => {
                // Draw connectors as yellow circles
                obj.getConnectors().forEach(c => {
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, radius, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(251, 191, 36, 0.7)'; // amber-400
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)'; // amber-600
                    ctx.lineWidth = currentLineWidth;
                    ctx.stroke();
                });
        // Draw intersection points as blue squares
        obj.getIntersectionPoints().forEach(p => {
            ctx.fillStyle = 'rgba(96, 165, 250, 0.7)'; // blue-400
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // blue-500
            ctx.lineWidth = currentLineWidth;
            ctx.fillRect(p.x - rectSize/2, p.y - rectSize/2, rectSize, rectSize);
            ctx.strokeRect(p.x - rectSize/2, p.y - rectSize/2, rectSize, rectSize);
        });
    });
    ctx.restore();
}


function drawConnectorsForDrag() {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    objects.forEach(obj => {
        if (obj.groupId === drag.target?.groupId) return;
        obj.getConnectors().forEach(c => {
            if (drag.target.getConnectors().some(tc => tc.diameter === c.diameter)) {
                ctx.beginPath();
                ctx.arc(c.x, c.y, DRAG_SNAP_DISTANCE / 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    });
}

function drawMeasureTool() {
    if (measurePoints.length === 0 && !currentSnapPoint) return;

    ctx.strokeStyle = '#db2777';
    ctx.fillStyle = '#db2777';
    ctx.lineWidth = 2 * currentLineWidth;

    let p1_info = measurePoints.length > 0 ? measurePoints[0] : currentSnapPoint;
    let p2_info = currentSnapPoint || (measurePoints.length > 0 ? { point: getWorldMousePos(lastMousePos) } : p1_info);
    
    let p1 = p1_info ? p1_info.point : null;
    let p2 = p2_info ? p2_info.point : null;
    
    if (p1) {
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 5 / camera.zoom, 0, 2 * Math.PI);
        ctx.fill();
    }
    if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        ctx.save();
        ctx.translate(midX, midY);
        ctx.font = `${currentFontSize}px sans-serif`;
        const text = `L: ${distance.toFixed(1)}`;
        const textMetrics = ctx.measureText(text);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(-textMetrics.width/2 - 5/camera.zoom, -15/camera.zoom, textMetrics.width + 10/camera.zoom, 22/camera.zoom);
        ctx.fillStyle = '#db2777';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }
    
            if (currentSnapPoint) {
                ctx.strokeStyle = '#4f46e5';
                ctx.lineWidth = 2 * currentLineWidth; // 線幅も修正
                ctx.beginPath();
                ctx.arc(currentSnapPoint.point.x, currentSnapPoint.point.y, 8 * currentLineWidth, 0, 2 * Math.PI);
                ctx.stroke();
            }}

function drawDimensions() {
    ctx.save();
    // Default colors are set inside the loop

    const dimensionGroups = new Map();
    dimensions.forEach(dim => {
        const p1 = getPointForDim(dim.p1_objId, dim.p1_pointType, dim.p1_pointId);
        const p2 = getPointForDim(dim.p2_objId, dim.p2_pointType, dim.p2_pointId);
        if (!p1 || !p2) return;

        let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        if (angle < 0) angle += Math.PI;
        
        const A = p1.y - p2.y;
        const B = p2.x - p1.x;
        const C = p1.x * p2.y - p2.x * p1.y;
        const perpDist = C / Math.sqrt(A*A + B*B);

        const key = `${angle.toFixed(2)}|${(perpDist / 10).toFixed(0)}`; 
        
        if (!dimensionGroups.has(key)) {
            dimensionGroups.set(key, []);
        }
        dimensionGroups.get(key).push({ ...dim, p1, p2 });
    });

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
            ctx.lineWidth = 1.5 * currentLineWidth;
            ctx.font = `${currentFontSize16}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

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
            
            const p1_ext = { x: p1_dim.x + extensionOverhang * perpDx, y: p1_dim.y + extensionOverhang * perpDy };
            const p2_ext = { x: p2_dim.x + extensionOverhang * perpDx, y: p2_dim.y + extensionOverhang * perpDy };

            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1_ext.x, p1_ext.y);
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p2_ext.x, p2_ext.y);
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            drawArrow(p1_dim.x, p1_dim.y, p2_dim.x, p2_dim.y);
            
            const midX = (p1_dim.x + p2_dim.x) / 2;
            const midY = (p1_dim.y + p2_dim.y) / 2;

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                ctx.rotate(Math.PI);
            }
            const text = value.toFixed(1);
            const textMetrics = ctx.measureText(text);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(-textMetrics.width / 2 - (2 * currentLineWidth), -(16 * currentLineWidth), textMetrics.width + (4 * currentLineWidth), (18 * currentLineWidth));
            
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
    
function drawArrow(fromX, fromY, toX, toY) {
    const headlen = 8 * currentLineWidth;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

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


function getScreenMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

function getWorldMousePos(screenPos) {
    const { x, y } = screenPos;
    const worldX = (x - canvas.width / 2) / camera.zoom + canvas.width / 2 - camera.x;
    const worldY = (y - canvas.height / 2) / camera.zoom + canvas.height / 2 - camera.y;
    return { x: worldX, y: worldY };
}

let lastMousePos = { x: 0, y: 0 };
function handleMouseDown(e) {
    e.preventDefault();
    
    // ピンチ操作の開始を検知
    if (e.touches && e.touches.length === 2) {
        pan.isPanning = false; // パン操作をキャンセル
        drag.isDragging = false; // ドラッグ操作をキャンセル
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        pinch.initialDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        pinch.isPinching = true;
        canvas.classList.remove('grabbing');
        return;
    }

    const screenPos = getScreenMousePos(e);
    const worldPos = getWorldMousePos(screenPos);
    lastMousePos = screenPos;
    
    if (mode === 'measure') {
        currentSnapPoint = findSnapPoint(worldPos);
        if (currentSnapPoint) {
            measurePoints.push(currentSnapPoint);
            if (measurePoints.length === 2) {
                showDistanceModal();
            }
        }
        draw();
        return;
    }

    const target = getObjectAt(worldPos.x, worldPos.y);
    objects.forEach(o => o.isSelected = false);
    selectedObject = null;
    hideContextMenu();

    if (target) {
        target.isSelected = true;
        selectedObject = target;
        drag.isDragging = true;
        drag.target = target;
        drag.offsetX = worldPos.x - target.x;
        drag.offsetY = worldPos.y - target.y;
        
        drag.initialPositions.clear();
        const targetGroupId = target.groupId;
        objects.forEach(obj => {
            if (obj.groupId === targetGroupId) {
                drag.initialPositions.set(obj.id, { x: obj.x, y: obj.y });
            }
        });
        showContextMenu(target);
    } else {
        pan.isPanning = true;
        pan.startX = screenPos.x;
        pan.startY = screenPos.y;
        canvas.classList.add('grabbing');
    }
    draw();
}

function handleMouseMove(e) {
    e.preventDefault();

    // ピンチ操作中の処理
    if (e.touches && e.touches.length === 2 && pinch.isPinching) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const newDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        
        if (pinch.initialDist > 0) {
            const zoomFactor = newDist / pinch.initialDist;
            
            // 2本の指の中点を基準にズームする
            const rect = canvas.getBoundingClientRect();
            const midpointScreen = {
                x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
                y: (touch1.clientY + touch2.clientY) / 2 - rect.top
            };
            const worldPosBeforeZoom = getWorldMousePos(midpointScreen);

            camera.zoom *= zoomFactor;
            camera.zoom = Math.max(0.1, Math.min(camera.zoom, 10)); // ズーム率に上限と下限を設定

            const worldPosAfterZoom = getWorldMousePos(midpointScreen);

            // ズーム中心がずれないようにカメラ位置を補正
            camera.x += (worldPosBeforeZoom.x - worldPosAfterZoom.x);
            camera.y += (worldPosBeforeZoom.y - worldPosAfterZoom.y);
        }
        
        pinch.initialDist = newDist; // 次のフレームのために距離を更新
        draw();
        return;
    }

    const screenPos = getScreenMousePos(e);
    const worldPos = getWorldMousePos(screenPos);
    lastMousePos = screenPos;

    if (drag.isDragging && drag.target) {
        const initialTargetPos = drag.initialPositions.get(drag.target.id);
        const total_dx = (worldPos.x - drag.offsetX) - initialTargetPos.x;
        const total_dy = (worldPos.y - drag.offsetY) - initialTargetPos.y;
        
        drag.initialPositions.forEach((pos, id) => {
            const objToMove = objects.find(o => o.id === id);
            if (objToMove) {
                objToMove.x = pos.x + total_dx;
                objToMove.y = pos.y + total_dy;
            }
        });
        showContextMenu(drag.target);

    } else if (pan.isPanning) {
        const dx = screenPos.x - pan.startX;
        const dy = screenPos.y - pan.startY;
        camera.x += dx / camera.zoom;
        camera.y += dy / camera.zoom;
        pan.startX = screenPos.x;
        pan.startY = screenPos.y;
    }
    
    if (mode === 'measure') {
        currentSnapPoint = findSnapPoint(worldPos);
    } else {
        currentSnapPoint = null;
    }
    
    draw();
}

function handleMouseUp(e) {
    e.preventDefault();
    
    // ピンチ操作の終了を検知
    if (pinch.isPinching && (!e.touches || e.touches.length < 2)) {
        pinch.isPinching = false;
        pinch.initialDist = 0;
    }

    if (drag.isDragging && drag.target) {
        let connectionMade = false;
        const draggedGroupId = drag.target.groupId;
        
        let bestSnap = { dist: CONNECT_DISTANCE / camera.zoom, dx: 0, dy: 0, otherGroupId: -1 };

        for (const [id] of drag.initialPositions.entries()) {
            const draggedObj = objects.find(o => o.id === id);
            if (!draggedObj) continue;

            for (const tc of draggedObj.getConnectors()) {
                for (const otherObj of objects) {
                    if (otherObj.groupId !== draggedGroupId) {
                        for (const c of otherObj.getConnectors()) {
                            if (tc.diameter === c.diameter) {
                                const dist = Math.hypot(tc.x - c.x, tc.y - c.y);
                                if (dist < bestSnap.dist) {
                                    bestSnap.dist = dist;
                                    bestSnap.dx = c.x - tc.x;
                                    bestSnap.dy = c.y - tc.y;
                                    bestSnap.otherGroupId = otherObj.groupId;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (bestSnap.otherGroupId !== -1) {
            objects.forEach(obj => {
                if (obj.groupId === draggedGroupId) {
                    obj.x += bestSnap.dx;
                    obj.y += bestSnap.dy;
                }
            });
            objects.forEach(obj => {
                if (obj.groupId === bestSnap.otherGroupId) {
                    obj.groupId = draggedGroupId;
                }
            });
            connectionMade = true;
        }
        
        const initialPos = drag.initialPositions.get(drag.target.id);
        const posChanged = drag.target.x !== initialPos.x || drag.target.y !== initialPos.y;
        if (posChanged || connectionMade) {
            saveState();
        }
    }
    pan.isPanning = false;
    drag.isDragging = false;
    drag.target = null;
    canvas.classList.remove('grabbing');
    draw();
}


function handleWheel(e) {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY > 0 ? -1 : 1;
    const zoomFactor = Math.exp(delta * zoomIntensity);
    camera.zoom *= zoomFactor;
    camera.zoom = Math.max(0.1, Math.min(camera.zoom, 10));
    draw();
}

function getObjectAt(x, y) {
    // Fittings have priority over straight ducts, so check them first.
    for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].type !== 'StraightDuct' && objects[i].isPointInside(x, y)) {
            return objects[i];
        }
    }
     for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].type === 'StraightDuct' && objects[i].isPointInside(x, y)) {
            return objects[i];
        }
    }
    return null;
}

function showContextMenu(obj) {
    const screenX = (obj.x + camera.x - canvas.width/2) * camera.zoom + canvas.width/2;
    const screenY = (obj.y + camera.y - canvas.height/2) * camera.zoom + canvas.height/2;
    contextMenu.classList.remove('hidden');
    contextMenu.style.left = `${screenX - contextMenu.offsetWidth / 2}px`;
    contextMenu.style.top = `${screenY - 50 - obj.diameter/2 * camera.zoom}px`;
}

function hideContextMenu() { contextMenu.classList.add('hidden'); }

// =================================================================================
// パレット開閉
// =================================================================================
document.getElementById('toggle-palette-btn').onclick = () => {
    const palette = document.getElementById('palette');
    palette.classList.toggle('hidden');
    // レイアウトの再計算を待ってからキャンバスをリサイズする
    setTimeout(resizeCanvas, 50); 
};


// =================================================================================
// ヘルパー関数
// =================================================================================
function getLegLength(obj, conn) {
    if (!obj || !conn) return 0;
    // 計測点が継手の中心(intersection)の場合は脚長を0として扱う
    if (conn.id === 'center') return 0;
    
    switch(obj.type) {
        case 'Elbow90':
        case 'AdjustableElbow':
            return obj.legLength;
        case 'TeeReducer':
             if (conn.type === 'branch') return obj.branchLength;
             // For main connectors, calculate distance from connector to intersection point
             if (conn.id === 0) return obj.length / 2 + obj.intersectionOffset; // conn 0 is left (-length/2)
             if (conn.id === 1) return obj.length / 2 - obj.intersectionOffset; // conn 1 is right (+length/2)
             return obj.length / 2; // Fallback
        case 'YBranch':
        case 'YBranchReducer':
             if (conn.type === 'branch') return obj.branchLength;
             if (conn.id === 0) return obj.length / 2 + obj.intersectionOffset;
             if (conn.id === 1) return obj.length / 2 - obj.intersectionOffset;
             return obj.length / 2; // Fallback
        default:
            return 0;
    }
}

const getDimensionKey = (dim) => {
    const part1 = `${dim.p1_objId}:${dim.p1_pointType}:${dim.p1_pointId}`;
    const part2 = `${dim.p2_objId}:${dim.p2_pointType}:${dim.p2_pointId}`;
    return [part1, part2].sort().join('|');
};

const getPointForDim = (objId, pointType, pointId) => {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return null;
    const points = pointType === 'connector' ? obj.getConnectors() : obj.getIntersectionPoints();
    const point = points.find(p => p.id === pointId);
    return point ? { x: point.x, y: point.y } : null;
};


// =================================================================================
// 汎用モーダル・通知関数
// =================================================================================
function addOrUpdateDimension(dimData) {
    const newKey = getDimensionKey(dimData);
    const existingDimIndex = dimensions.findIndex(d => getDimensionKey(d) === newKey);

    if (existingDimIndex > -1) {
        // Update existing dimension's value
        dimensions[existingDimIndex].value = dimData.value;
    } else {
        // Add new dimension with a unique ID
        dimensions.push({ ...dimData, id: Date.now() });
    }
}

function showModal(title, bodyHtml, footerHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}
function hideModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}
function showConfirmModal(title, message, onConfirm) {
    const body = `<p>${message}</p>`;
    const footer = `
        <button id="modal-cancel" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">キャンセル</button>
        <button id="modal-confirm" class="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700">実行</button>
    `;
    showModal(title, body, footer);
    document.getElementById('modal-cancel').onclick = hideModal;
    document.getElementById('modal-confirm').onclick = () => {
        onConfirm();
        hideModal();
    };
}

function showDistanceModal() {
    const [p1_info, p2_info] = measurePoints;
    const measuredDistance = Math.hypot(p2_info.point.x - p1_info.point.x, p2_info.point.y - p1_info.point.y);

    const findEndpointObject = (pointInfo) => {
        if (pointInfo.pointType === 'intersection') return pointInfo.object;
        const connectedFitting = objects.find(o =>
            o.id !== pointInfo.object.id &&
            o.groupId === pointInfo.object.groupId &&
            o.type !== 'StraightDuct' &&
            o.getConnectors().some(c => Math.hypot(c.x - pointInfo.point.x, c.y - pointInfo.point.y) < 1)
        );
        return connectedFitting || pointInfo.object;
    };

    const obj1 = findEndpointObject(p1_info);
    const obj2 = findEndpointObject(p2_info);

    let ductToUpdate = null;
    if (obj1 && obj2 && obj1.groupId === obj2.groupId) {
        if (obj1.type === 'StraightDuct' && obj1.id === obj2.id) {
            ductToUpdate = obj1;
        } else {
            const straightDuctsInGroup = objects.filter(o => o.groupId === obj1.groupId && o.type === 'StraightDuct');
            for (const duct of straightDuctsInGroup) {
                const conns = duct.getConnectors();
                const connectsTo1 = conns.some(c1 => obj1.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1));
                const connectsTo2 = conns.some(c1 => obj2.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1));
                if (connectsTo1 && connectsTo2) {
                    ductToUpdate = duct;
                    break;
                }
            }
        }
    }
    
    // Helper function to find the relevant leg length of a fitting connected to a specific duct
    const getConnectedLegLength = (fitting, duct) => {
        if (!fitting || !duct || fitting.type === 'StraightDuct') return 0;
        const ductConns = duct.getConnectors();
        const fittingConns = fitting.getConnectors();
        let relevantConn = null;
        for (const fc of fittingConns) {
            // Find the connector on the fitting that is connected to the duct
            if (ductConns.some(dc => Math.hypot(fc.x - dc.x, dc.y - dc.y) < 1)) {
                relevantConn = fc;
                break;
            }
        }
        return getLegLength(fitting, relevantConn);
    };

    const isP1Intersection = p1_info.pointType === 'intersection';
    const isP2Intersection = p2_info.pointType === 'intersection';

    let lengthToSubtract = 0;
    if (ductToUpdate) {
        const contribution1 = isP1Intersection ? getConnectedLegLength(obj1, ductToUpdate) : 0;
        const contribution2 = isP2Intersection ? getConnectedLegLength(obj2, ductToUpdate) : 0;
        lengthToSubtract = contribution1 + contribution2;
    }


    const title = ductToUpdate ? '直管長の再計算・更新' : '寸法線の追加';
    const body = `<p class="mb-2 text-sm text-gray-600">2点間の中心線距離 (全長) を入力してください。</p>
                  <input type="number" id="manual-distance-input" value="${measuredDistance.toFixed(1)}" class="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500">`;
    const footer = `<button id="modal-cancel" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">キャンセル</button>
                    <button id="modal-confirm" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700">${ductToUpdate ? '計算して更新' : '寸法を追加'}</button>`;
    showModal(title, body, footer);
    
    const input = document.getElementById('manual-distance-input');
    input.focus();
    input.select();

    const confirmAction = () => {
        const totalDistance = parseFloat(input.value);
        if (isNaN(totalDistance)) { hideModal(); return; }

        const newDimensionData = {
            p1_objId: p1_info.object.id, p1_pointId: p1_info.pointId, p1_pointType: p1_info.pointType,
            p2_objId: p2_info.object.id, p2_pointId: p2_info.pointId, p2_pointType: p2_info.pointType,
            value: totalDistance
        };

        if (ductToUpdate) {
            const finalDuctLength = totalDistance - lengthToSubtract;

            if (finalDuctLength < 0) { // 0も許容しないように < 0 に変更
                hideModal();
                setTimeout(() => {
                    showModal(
                        '計算エラー',
                        `<p>全長 (${totalDistance.toFixed(1)}mm) から継手の長さ (${lengthToSubtract.toFixed(1)}mm) を引くと、直管長がマイナス (${finalDuctLength.toFixed(1)}mm) になります。値を修正してください。</p>`,
                        '<button id="modal-ok" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700">OK</button>'
                    );
                    document.getElementById('modal-ok').onclick = hideModal;
                }, 100);
                
                measurePoints = [];
                document.getElementById('measure-tool').classList.remove('bg-indigo-200');
                mode = 'pan';
                draw();
                return;
            }

            const oldLength = ductToUpdate.length;
            const ductConns = ductToUpdate.getConnectors();
            const isP1CloserToConn0 = Math.hypot(p1_info.point.x - ductConns[0].x, p1_info.point.y - ductConns[0].y) < Math.hypot(p1_info.point.x - ductConns[1].x, p1_info.point.y - ductConns[1].y);
            const anchorConnPoint = isP1CloserToConn0 ? ductConns[0] : ductConns[1];
            const movingConnPoint = isP1CloserToConn0 ? ductConns[1] : ductConns[0];
            
            const direction = (oldLength > 0.1) ? { x: (movingConnPoint.x - anchorConnPoint.x) / oldLength, y: (movingConnPoint.y - anchorConnPoint.y) / oldLength } : {x: Math.cos(ductToUpdate.rotation * Math.PI / 180), y: Math.sin(ductToUpdate.rotation * Math.PI/180)};
            const lengthChange = finalDuctLength - oldLength;
            const dx = direction.x * lengthChange;
            const dy = direction.y * lengthChange;

            const movingBranchRoot = objects.find(o => o.id !== ductToUpdate.id && o.getConnectors().some(c => Math.hypot(c.x - movingConnPoint.x, c.y - movingConnPoint.y) < 1));
            const objectsToMove = new Set();
            if (movingBranchRoot) {
                const queue = [movingBranchRoot];
                objectsToMove.add(movingBranchRoot.id);
                let head = 0;
                while(head < queue.length){
                    const current = queue[head++];
                    for (const neighbor of objects) {
                        if (neighbor.groupId === current.groupId && !objectsToMove.has(neighbor.id) && neighbor.id !== ductToUpdate.id) {
                           if (current.getConnectors().some(c1 => neighbor.getConnectors().some(c2 => Math.hypot(c1.x - c2.x, c1.y - c2.y) < 1))) {
                               objectsToMove.add(neighbor.id);
                               queue.push(neighbor);
                           }
                        }
                    }
                }
            }
            
            objects.forEach(obj => {
                if (objectsToMove.has(obj.id)) {
                    obj.x += dx;
                    obj.y += dy;
                }
            });
            
            ductToUpdate.length = finalDuctLength;
            ductToUpdate.x = anchorConnPoint.x + direction.x * finalDuctLength / 2;
            ductToUpdate.y = anchorConnPoint.y + direction.y * finalDuctLength / 2;
            
            // 既存の寸法を全て更新
            dimensions.forEach(dim => {
                const p1 = getPointForDim(dim.p1_objId, dim.p1_pointType, dim.p1_pointId);
                const p2 = getPointForDim(dim.p2_objId, dim.p2_pointType, dim.p2_pointId);
                if (p1 && p2) {
                    dim.value = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                }
            });

            // 新しい寸法を、追加または更新
            addOrUpdateDimension(newDimensionData);

            showNotification(`直管の長さを ${finalDuctLength.toFixed(1)} mmに更新しました。`);
        
        } else {
            // ductToUpdate がない場合は、寸法線を追加または更新
            addOrUpdateDimension(newDimensionData);
            showNotification('寸法線を追加/更新しました。');
        }
        
        // 正常終了時の後処理
        mode = 'pan';
        measurePoints = [];
        document.getElementById('measure-tool').classList.remove('bg-indigo-200');
        hideModal();
        saveState();
        draw();
    };

    document.getElementById('modal-cancel').onclick = () => { measurePoints = []; draw(); hideModal(); };
    document.getElementById('modal-confirm').onclick = confirmAction;
    input.onkeydown = (e) => { if (e.key === 'Enter') confirmAction(); };
}

let notificationTimeout;
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('opacity-0');

    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        notification.classList.add('opacity-0');
    }, 3000);
}

// =================================================================================
// UIとイベントハンドラ
// =================================================================================
function setupUI() {
  // Diagnostic comment to investigate UI instability

    document.getElementById('undo-btn').onclick = undo;
    document.getElementById('redo-btn').onclick = redo;

    document.getElementById('zoom-in').onclick = () => { camera.zoom *= 1.2; draw(); };
    document.getElementById('zoom-out').onclick = () => { camera.zoom /= 1.2; draw(); };
    document.getElementById('reset-view').onclick = () => { camera.x = 0; camera.y = 0; camera.zoom = 1 / (1.2 * 1.2); draw(); };
    document.getElementById('clear-canvas').onclick = () => {
        showConfirmModal('キャンバスをクリア', 'すべての部品と寸法を削除します。よろしいですか？', () => {
            objects = [];
            dimensions = [];
            selectedObject = null;
            measurePoints = [];
            hideContextMenu();
            saveState();
            draw();
        });
    };
    document.getElementById('print-btn').onclick = () => window.print();

    document.getElementById('screenshot-btn').onclick = () => {
        const link = document.createElement('a');
        link.download = `duct-design-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.png`;
        
        const wasSelected = selectedObject;
        if (wasSelected) wasSelected.isSelected = false;
        hideContextMenu();
        draw();
        
        link.href = canvas.toDataURL('image/png');
        link.click();

        if(wasSelected) {
            wasSelected.isSelected = true;
            showContextMenu(wasSelected);
        }
        draw();
    };

    document.getElementById('share-btn').onclick = async () => {
        const shareData = {
            title: '簡易ダクト設計アプリ',
            text: 'このダクト設計をチェックしてください！',
            url: window.location.href,
        };

        const fallbackCopy = () => {
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                     showNotification('URLをクリップボードにコピーしました');
                } else {
                     showNotification('クリップボードへのコピーに失敗しました');
                }
            } catch (err) {
                console.error('Fallback copy failed', err);
                showNotification('クリップボードへのコピーに失敗しました');
            }
            document.body.removeChild(textArea);
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
               fallbackCopy();
            }
        } catch (err) {
            console.log('Share failed, falling back to clipboard:', err);
            fallbackCopy();
        }
    };


    document.getElementById('measure-tool').onclick = (e) => {
        mode = mode === 'measure' ? 'pan' : 'measure';
        measurePoints = [];
        e.currentTarget.classList.toggle('bg-indigo-200', mode === 'measure');
        if (mode === 'pan') {
            currentSnapPoint = null;
            draw();
        }
    };
    
    document.getElementById('add-custom-straight').onclick = () => {
        const diameter = parseInt(document.getElementById('custom-diameter').value);
        if (isNaN(diameter) || diameter <= 0) return;

        const systemName = document.getElementById('system-name').value;

        // 直径100を基準として、新しい直径に合わせてズームを調整
        const baseDiameter = 100;
        const defaultZoom = 1 / (1.2 * 1.2);
        camera.zoom = (baseDiameter / diameter) * defaultZoom;

        const worldCenter = getWorldMousePos({x: canvas.width/2, y: canvas.height/2});
        objects.push(new StraightDuct(worldCenter.x, worldCenter.y, { diameter, systemName, length: 200 }));
        
        saveState();
        draw();
    };

document.getElementById('rotate-btn').addEventListener('click', () => {
    if (!selectedObject) return;

    const groupId = selectedObject.groupId;
    const groupObjects = objects.filter(obj => obj.groupId === groupId);
    const rotationAngle = 45;

    if (groupObjects.length > 1) {
        // Group rotation
        let sumX = 0;
        let sumY = 0;
        groupObjects.forEach(obj => {
            sumX += obj.x;
            sumY += obj.y;
        });
        const centerX = sumX / groupObjects.length;
        const centerY = sumY / groupObjects.length;

        const rad = rotationAngle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        groupObjects.forEach(obj => {
            const dx = obj.x - centerX;
            const dy = obj.y - centerY;
            obj.x = centerX + (dx * cos - dy * sin);
            obj.y = centerY + (dx * sin + dy * cos);
            obj.rotation = (obj.rotation + rotationAngle) % 360;
        });
    } else {
        // Single object rotation
        selectedObject.rotate();
    }

    saveState();
    draw();
    showContextMenu(selectedObject);
});
    document.getElementById('flip-btn').onclick = () => {
        if (selectedObject && typeof selectedObject.flip === 'function') {
            selectedObject.flip();
            showContextMenu(selectedObject);
            saveState();
            draw();
        }
    };
     document.getElementById('delete-btn').onclick = () => {
        if (selectedObject) {
            const deletedId = selectedObject.id;
            objects = objects.filter(o => o.id !== deletedId);
            dimensions = dimensions.filter(d => d.p1_objId !== deletedId && d.p2_objId !== deletedId);
            selectedObject = null;
            hideContextMenu();
            saveState();
            draw();
        }
    };
    document.getElementById('disconnect-btn').onclick = () => {
        if (selectedObject) {
            const oldGroupId = selectedObject.groupId;
            selectedObject.groupId = selectedObject.id;
            const remainingInGroup = objects.filter(o => o.groupId === oldGroupId);
            recalculateGroups(remainingInGroup);
            saveState();
            draw();
        }
    };


    window.onkeydown = (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') undo();
            if (e.key === 'y') redo();
        }
        if (!selectedObject) return;
        if (e.key === 'r' || e.key === 'R') {
             document.getElementById('rotate-btn').click();
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
             document.getElementById('delete-btn').click();
        }
    };

    document.getElementById('manage-fittings-btn').onclick = () => {
        buildFittingsEditor();
        document.getElementById('fittings-modal').classList.remove('hidden');
        document.getElementById('fittings-modal').classList.add('flex');
    };
    document.getElementById('close-modal-btn').onclick = () => {
        document.getElementById('fittings-modal').classList.add('hidden');
        document.getElementById('fittings-modal').classList.remove('flex');
    };
    document.getElementById('save-fittings-btn').onclick = saveFittings;
}

function createPaletteItem(item, type) {
    const div = document.createElement('div');
    div.className = 'palette-item bg-white p-2 border rounded-md shadow-sm cursor-pointer text-center';
    div.draggable = true;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 50 50');
    svg.setAttribute('class', 'w-12 h-12 mx-auto');
    let shape;
    const color = getColorForDiameter(item.diameter);
    if (type.includes('90°エルボ')) shape = `<path d="M5 45 V 5 H 45" stroke="${color}" stroke-width="10" fill="none" />`;
    else if (type.includes('エルボ')) shape = `<path d="M5 45 L 25 25 L 45 35" stroke="${color}" stroke-width="10" fill="none" />`;
    else if (type.includes('T字管')) shape = `<path d="M5 25 H 45 M 25 25 V 5" stroke="${color}" stroke-width="10" fill="none" />`;
    else if (type.includes('Y蟄礼ｮ｡')) shape = `<path d="M5 25 H 45 M 25 25 L 40 10" stroke="${color}" stroke-width="8" fill="none" />`;
    else if (type.includes('ダンパー')) shape = `<rect x="5" y="20" width="40" height="10" fill="${color}" /><line x1="10" y1="25" x2="40" y2="25" stroke="#1e293b" stroke-width="2" />`;
    else shape = `<rect x="5" y="20" width="40" height="10" fill="${color}" />`;
    svg.innerHTML = shape;
    
    const p = document.createElement('p');
    p.className = 'text-sm mt-1 font-medium';
    p.textContent = item.name;

    div.append(svg, p);
    
    // Mouse drag events
    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        e.dataTransfer.setData('text/plain', type);
    });

    // Touch drag events
    div.addEventListener('touchstart', (e) => handlePaletteTouchStart(e, item, type, div), { passive: false });
    
    return div;
}

function addObject(item, type, pos) {
    let newObj;
    const options = { ...item, systemName: document.getElementById('system-name').value };

    switch(type) {
        case '90°エルボ': newObj = new Elbow90(pos.x, pos.y, options); break;
        case '45°エルボ':
        case '可変角度エルボ': newObj = new AdjustableElbow(pos.x, pos.y, options); break;
        case 'T字管レジューサー': newObj = new TeeReducer(pos.x, pos.y, options); break;
        case 'Y字管レジューサー': newObj = new YBranchReducer(pos.x, pos.y, options); break;
        case 'レジューサー': newObj = new Reducer(pos.x, pos.y, options); break;
        case 'ダンパー': newObj = new Damper(pos.x, pos.y, options); break;
    }
    if (newObj) {
        objects.push(newObj);
        saveState();
        draw();
    }
}

function populatePalette() {
    const palette = document.getElementById('palette-items');
    palette.innerHTML = '';
    for (const type in fittings) {
        fittings[type].forEach(item => {
            if (item.visible) palette.appendChild(createPaletteItem(item, type));
        });
    }
}


// =================================================================================
// 継手管理
// =================================================================================
function buildFittingsEditor() {
    const editor = document.getElementById('fittings-editor');
    editor.innerHTML = '';
    for (const category in fittings) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'mb-6 p-4 border rounded-lg';
        const title = document.createElement('h3');
        title.className = 'text-xl font-semibold mb-3 border-b pb-2';
        title.textContent = category;
        categoryDiv.appendChild(title);
        const table = document.createElement('table');
        table.className = 'w-full text-left table-auto';
        
        const headers = ['名前', 'D1(mm)'];
        const hasD2 = fittings[category].some(i => i.diameter2 !== undefined);
        const hasD3 = fittings[category].some(i => i.diameter3 !== undefined);
        const hasLegLength = fittings[category].some(i => i.legLength !== undefined);
        const hasLength = fittings[category].some(i => i.length !== undefined);
        const hasBranchLength = fittings[category].some(i => i.branchLength !== undefined);
        const hasIntersectionOffset = fittings[category].some(i => i.intersectionOffset !== undefined);
        const hasAngle = fittings[category].some(i => i.angle !== undefined);
        const isDamper = category === 'ダンパー';
        
        if (hasD2) headers.push('D2(mm)');
        if (hasD3) headers.push('D3(mm)');
        if (hasLegLength) headers.push('脚長(mm)');
        if (hasLength) headers.push('主管長(mm)');
        if (hasBranchLength) headers.push('枝管長(mm)');
        if (hasIntersectionOffset) headers.push('交点オフセット(mm)');
        if (hasAngle) headers.push('角度(°)');
        headers.push('表示', '操作');

        table.innerHTML = `<thead><tr>${headers.map(h => `<th class="p-2 text-sm font-semibold">${h}</th>`).join('')}</tr></thead>`;
        const tbody = document.createElement('tbody');
        fittings[category].forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'border-t';
            tr.dataset.category = category;
            tr.dataset.index = index;
            tr.dataset.id = item.id;
            
            // Define auto-naming logic
            let isAutoNamed = false;
            let nameValue = item.name;
            let autoNameType = '';

            const isTeeYReducer = category.includes('レジューサー') && (category.includes('Y字管') || category.includes('T字管'));
            const isAdjElbow = category.includes('可変角度エルボ');
            const isSimpleElbow = (category.includes('90°エルボ') || category.includes('45°エルボ'));
            const isSimpleReducer = category === 'レジューサー';
            const isDamper = category === 'ダンパー';

            if (isTeeYReducer) {
                isAutoNamed = true;
                autoNameType = 'TeeYReducer';
                nameValue = `D${item.diameter || ''}-${item.diameter2 || ''}-${item.diameter3 || ''}`;
            } else if (isAdjElbow) {
                isAutoNamed = true;
                autoNameType = 'AdjElbow';
                nameValue = `D${item.diameter || ''} ${item.angle || ''}°`;
            } else if (isSimpleElbow) {
                isAutoNamed = true;
                autoNameType = 'Elbow';
                nameValue = `D${item.diameter || ''}`;
            } else if (isSimpleReducer) {
                isAutoNamed = true;
                autoNameType = 'Reducer';
                nameValue = `D${item.diameter || ''}-${item.diameter2 || ''}`;
            } else if (isDamper) {
                isAutoNamed = true;
                autoNameType = 'Damper';
                nameValue = `VD${item.diameter || ''}`;
            }

            let cells = `<td class="p-2"><input type="text" value="${nameValue}" class="p-1 border rounded min-w-[50px]" data-prop="name" ${isAutoNamed ? 'readonly style="background-color: #e9e9e9;"' : ''}></td>
                         <td class="p-2"><input type="number" value="${item.diameter}" class="w-20 p-1 border rounded" data-prop="diameter" step="25"></td>`;

            if (hasD2) cells += `<td class="p-2"><input type="number" value="${item.diameter2 || ''}" class="w-20 p-1 border rounded" data-prop="diameter2" step="25"></td>`;
            if (hasD3) cells += `<td class="p-2"><input type="number" value="${item.diameter3 || ''}" class="w-20 p-1 border rounded" data-prop="diameter3" step="25"></td>`;
            if (hasLegLength) cells += `<td class="p-2"><input type="number" value="${item.legLength || ''}" class="w-20 p-1 border rounded" data-prop="legLength"></td>`;
            if (hasLength) cells += `<td class="p-2"><input type="number" value="${item.length || ''}" class="w-20 p-1 border rounded" data-prop="length"></td>`;
            if (hasBranchLength) cells += `<td class="p-2"><input type="number" value="${item.branchLength || ''}" class="w-20 p-1 border rounded" data-prop="branchLength"></td>`;
            if (hasIntersectionOffset) cells += `<td class="p-2"><input type="number" value="${item.intersectionOffset || 0}" class="w-20 p-1 border rounded" data-prop="intersectionOffset"></td>`;
            if (hasAngle) cells += `<td class="p-2"><input type="number" value="${item.angle || ''}" class="w-20 p-1 border rounded" data-prop="angle"></td>`;
            
            cells += `<td class="p-2 text-center"><input type="checkbox" ${item.visible ? 'checked' : ''} class="h-5 w-5 rounded" data-prop="visible"></td>
                      <td class="p-2"><button class="text-red-500 hover:text-red-700 font-semibold" onclick="removeFitting('${category}', ${index})">削除</button></td>`;
            
            tr.innerHTML = cells;
            tbody.appendChild(tr);

            // Set up auto-naming and auto-width for inputs
            const nameInput = tr.querySelector('[data-prop="name"]');
            console.log('nameInput:', nameInput, 'readonly:', nameInput?.readOnly); // デバッグログ追加
            
            const adjustNameInputWidth = () => {
                const span = document.createElement('span');
                span.style.font = window.getComputedStyle(nameInput).font;
                span.style.visibility = 'hidden';
                span.style.position = 'absolute';
                span.textContent = nameInput.value || nameInput.placeholder;
                document.body.appendChild(span);
                nameInput.style.width = `${span.offsetWidth + 20}px`; // Add a little padding
                document.body.removeChild(span);
            };

            if (nameInput) {
                adjustNameInputWidth();
                nameInput.addEventListener('input', adjustNameInputWidth);
            }

            // Automatic leg length calculation for simple elbows
            if (isSimpleElbow && !isAdjElbow) {
                const d1Input = tr.querySelector('[data-prop="diameter"]');
                const legLengthInput = tr.querySelector('[data-prop="legLength"]');
                if (d1Input && legLengthInput) {
                    const updateLegLength = () => {
                        const diameter = parseFloat(d1Input.value);
                        if (!isNaN(diameter)) {
                            let newLegLength;
                            if (category.includes('90°エルボ')) {
                                newLegLength = diameter;
                            } else { // 45°エルボ
                                newLegLength = Math.round(diameter * 0.4);
                            }
                            legLengthInput.value = newLegLength;
                        }
                    };
                    d1Input.addEventListener('input', updateLegLength);
                }
            }
            
            if (isAutoNamed) {
                const d1Input = tr.querySelector('[data-prop="diameter"]');
                console.log('Damper d1Input:', d1Input); // デバッグログ追加
                let updateName;

                switch (autoNameType) {
                    case 'TeeYReducer':
                        const d2Input_T = tr.querySelector('[data-prop="diameter2"]');
                        const d3Input_T = tr.querySelector('[data-prop="diameter3"]');
                        updateName = () => { nameInput.value = `D${d1Input.value || '?'}-${d2Input_T.value || '?'}-${d3Input_T.value || '?'}`; adjustNameInputWidth(); };
                        [d1Input, d2Input_T, d3Input_T].forEach(input => input?.addEventListener('input', updateName));
                        break;
                    case 'AdjElbow':
                        const angleInput = tr.querySelector('[data-prop="angle"]');
                        updateName = () => { nameInput.value = `D${d1Input.value || '?'} ${angleInput.value || '?'}°`; adjustNameInputWidth(); };
                        [d1Input, angleInput].forEach(input => input?.addEventListener('input', updateName));
                        break;
                    case 'Elbow':
                        updateName = () => { nameInput.value = `D${d1Input.value || '?'}`; adjustNameInputWidth(); };
                        d1Input?.addEventListener('input', updateName);
                        break;
                    case 'Reducer':
                        const d2Input_R = tr.querySelector('[data-prop="diameter2"]');
                        updateName = () => { nameInput.value = `D${d1Input.value || '?'}-${d2Input_R.value || '?'}`; adjustNameInputWidth(); };
                        [d1Input, d2Input_R].forEach(input => input?.addEventListener('input', updateName));
                        break;
                    case 'Damper': // ここから追加
                        updateName = () => { nameInput.value = `VD${d1Input.value || ''}`; adjustNameInputWidth(); };
                        d1Input?.addEventListener('input', updateName);
                        break; // ここまで追加
                }
            }
        });
        table.appendChild(tbody);
        categoryDiv.appendChild(table);
        const addBtn = document.createElement('button');
        addBtn.className = 'mt-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm';
        addBtn.textContent = '行を追加';
        addBtn.onclick = () => addFitting(category);
        categoryDiv.appendChild(addBtn);
        editor.appendChild(categoryDiv);
    }
}

function addFitting(category) {
    const isTReducer = category.includes('T字管') && category.includes('レジューサー');
    const isYReducer = category.includes('Y字管') && category.includes('レジューサー');
    const isAdjElbow = category.includes('可変角度エルボ');
    const is90Elbow = category.includes('90°エルボ');
    const is45Elbow = category.includes('45°エルボ');
    const isSimpleReducer = category === 'レジューサー';

    const newItem = { id: `${category.replace(/\s/g, '')}-${Date.now()}`, name: '新規', diameter: 100, visible: true };

    if (is90Elbow) {
        newItem.legLength = newItem.diameter;
        newItem.name = `D${newItem.diameter}`;
    } else if (is45Elbow) {
        newItem.legLength = Math.round(newItem.diameter * 0.4);
        newItem.angle = 135;
        newItem.name = `D${newItem.diameter}`;
    } else if (isAdjElbow) {
        newItem.legLength = 150;
        newItem.angle = 60;
        newItem.name = `D${newItem.diameter} ${newItem.angle}°`;
    } else if (isTReducer) { 
        newItem.length = 200; 
        newItem.branchLength = 150;
        newItem.intersectionOffset = 0;
        newItem.diameter2 = 100; 
        newItem.diameter3 = 100; 
        newItem.name = `D${newItem.diameter}-${newItem.diameter2}-${newItem.diameter3}`;
    } else if (isYReducer) {
        newItem.length = 300;
        newItem.branchLength = 200;
        newItem.angle = 45;
        newItem.intersectionOffset = 0;
        newItem.diameter2 = 100; 
        newItem.diameter3 = 100;
        newItem.name = `D${newItem.diameter}-${newItem.diameter2}-${newItem.diameter3}`;
    } else if (isSimpleReducer) {
        newItem.length = 150;
        newItem.diameter2 = 100;
        newItem.name = `D${newItem.diameter}-${newItem.diameter2}`;
    } else if (category === 'ダンパー') {
        newItem.name = `VD${newItem.diameter}`;
    }
    
    fittings[category].push(newItem);
    buildFittingsEditor();
}

function removeFitting(category, index) {
    fittings[category].splice(index, 1);
    buildFittingsEditor();
}

function saveFittings() {
    const editor = document.getElementById('fittings-editor');
    const newFittings = {};
    const categories = [...new Set([...editor.querySelectorAll('tbody tr')].map(tr => tr.dataset.category))];
    categories.forEach(cat => newFittings[cat] = []);

    editor.querySelectorAll('tbody tr').forEach(tr => {
        const { category, id } = tr.dataset;
        const newItem = { id };
        
        tr.querySelectorAll('input').forEach(input => {
            const prop = input.dataset.prop;
            if (!prop) return;

            if (input.type === 'checkbox') {
                newItem[prop] = input.checked;
            } else if (input.type === 'number') {
                const numValue = parseFloat(input.value);
                // Store number if valid, otherwise store null to indicate it's empty/not set
                newItem[prop] = isNaN(numValue) ? null : numValue;
            } else {
                newItem[prop] = input.value;
            }
        });
        newFittings[category].push(newItem);
    });

    fittings = newFittings;
    localStorage.setItem('ductAppFittings', JSON.stringify(fittings));
    populatePalette();
    document.getElementById('close-modal-btn').click();
}

// =================================================================================
// ドラッグ＆ドロップハンドラ (Mouse & Touch)
// =================================================================================
function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    const itemJson = e.dataTransfer.getData('application/json');
    if (!type || !itemJson) return;

    const item = JSON.parse(itemJson);
    const screenPos = getScreenMousePos(e);
    const worldPos = getWorldMousePos(screenPos);
    
    addObject(item, type, worldPos);
}

function handlePaletteTouchStart(e, item, type, element) {
    e.preventDefault();
    if (touchDragState.isDragging) return;

    touchDragState.isDragging = true;
    touchDragState.item = item;
    touchDragState.type = type;

    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.opacity = '0.7';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '1000';
    document.body.appendChild(ghost);
    touchDragState.ghostElement = ghost;

    window.addEventListener('touchmove', handlePaletteTouchMove, { passive: false });
    window.addEventListener('touchend', handlePaletteTouchEnd, { once: true });
    window.addEventListener('touchcancel', handlePaletteTouchEnd, { once: true });
}

function handlePaletteTouchMove(e) {
    e.preventDefault();
    if (!touchDragState.isDragging || !e.touches[0]) return;
    const touch = e.touches[0];
    const ghost = touchDragState.ghostElement;
    ghost.style.left = `${touch.clientX - ghost.offsetWidth / 2}px`;
    ghost.style.top = `${touch.clientY - ghost.offsetHeight / 2}px`;
}

function handlePaletteTouchEnd(e) {
    if (!touchDragState.isDragging) return;

    const ghost = touchDragState.ghostElement;
    ghost.style.display = 'none';
    
    const touch = e.changedTouches[0];
    const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (elementUnder === canvas) {
        const rect = canvas.getBoundingClientRect();
        const screenPos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        const worldPos = getWorldMousePos(screenPos);
        addObject(touchDragState.item, touchDragState.type, worldPos);
    }

    document.body.removeChild(ghost);
    window.removeEventListener('touchmove', handlePaletteTouchMove);
    
    touchDragState.isDragging = false;
    touchDragState.item = null;
    touchDragState.type = '';
    touchDragState.ghostElement = null;
}

// =================================================================================
// 初期化処理
// =================================================================================
function init() {
    fittings = JSON.parse(localStorage.getItem('ductAppFittings')) || getDefaultFittings();
    setupUI();
    populatePalette();
    resizeCanvas();
    
    window.addEventListener('resize', resizeCanvas);
    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);

    // Touch events
    canvas.addEventListener('touchstart', handleMouseDown, { passive: false });
    canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
    canvas.addEventListener('touchend', handleMouseUp);
    canvas.addEventListener('touchcancel', handleMouseUp);

    saveState(); // Save the initial empty state
    draw();
}

init();