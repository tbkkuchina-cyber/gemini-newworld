'use client';

import React, { useRef, useEffect, useState } from 'react';
import { PaletteItemData } from '@/lib/types';
import {
    DuctPart,
    StraightDuct,
    Elbow90,
    AdjustableElbow,
    TeeReducer,
    Reducer,
    YBranch,
    YBranchReducer,
    Damper
} from '@/lib/objects';

interface PaletteIconProps {
    item: PaletteItemData;
}

const CANVAS_SIZE = 48; // ★ アイコンサイズを 64 -> 48 に変更

const PaletteIcon: React.FC<PaletteIconProps> = ({ item }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted) return; // マウントされるまで描画しない

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // オブジェクトのインスタンスを作成
        let obj: DuctPart;
        // アイコンプレビュー用に、オブジェクトを原点(0,0)に作成
        const options = { ...item.defaultOptions, x: 0, y: 0 };

        switch (item.type) {
            case 'StraightDuct': obj = new StraightDuct(0, 0, 0, options); break;
            case 'Elbow90': obj = new Elbow90(0, 0, 0, options); break;
            case 'AdjustableElbow': obj = new AdjustableElbow(0, 0, 0, options); break;
            case 'TeeReducer': obj = new TeeReducer(0, 0, 0, options); break;
            case 'Reducer': obj = new Reducer(0, 0, 0, options); break;
            case 'YBranch': obj = new YBranch(0, 0, 0, options); break;
            case 'YBranchReducer': obj = new YBranchReducer(0, 0, 0, options); break;
            case 'Damper': obj = new Damper(0, 0, 0, options); break;
            default: return;
        }

        // オブジェクトの描画境界を取得
        const bounds = obj.getBounds();
        const objWidth = bounds.w || 100;
        const objHeight = bounds.h || 100;

        // オブジェクトがキャンバスに収まるようにズーム率とオフセットを計算
        const scaleX = (CANVAS_SIZE * 0.8) / objWidth;
        const scaleY = (CANVAS_SIZE * 0.8) / objHeight;
        const zoom = Math.min(scaleX, scaleY);

        // バウンディングボックスの中心を原点に合わせるオフセット
        const offsetX = -bounds.x - objWidth / 2;
        const offsetY = -bounds.y - objHeight / 2;

        // 描画
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.save();
        ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(offsetX, offsetY);
        
        obj.draw(ctx, { zoom });

        ctx.restore();

    }, [item, isMounted]);

    return (
        <div className="flex flex-col items-center justify-center gap-1">
            {isMounted ? (
                <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
            ) : (
                <div style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }} /> // サーバーサイドと初回クライアントレンダリング用のプレースホルダー
            )}
            <p className="text-xs font-medium text-center">{item.name}</p>
        </div>
    );
};

export default PaletteIcon;