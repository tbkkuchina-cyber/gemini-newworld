import { useEffect, RefObject } from 'react';
import { useAtomValue } from 'jotai';
import {
  objectsAtom,
  cameraAtom,
  modeAtom,
  measurePointsAtom,
  mouseWorldPosAtom,
  dimensionsAtom
} from '@/lib/jotai-store';
import { drawGrid, drawObjects, drawAllSnapPoints, drawMeasureTool, drawDimensions } from '@/lib/canvas-utils';

export const useCanvas = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const objects = useAtomValue(objectsAtom);
  const camera = useAtomValue(cameraAtom);
  const mode = useAtomValue(modeAtom);
  const measurePoints = useAtomValue(measurePointsAtom);
  const mouseWorldPos = useAtomValue(mouseWorldPosAtom);
  const dimensions = useAtomValue(dimensionsAtom);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!camera || typeof camera.zoom !== 'number') {
        console.warn('[useCanvas] Skipping draw in useEffect because camera is not ready yet.', camera);
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!camera || typeof camera.zoom !== 'number') {
          console.error('[useCanvas] draw() called but camera is invalid!', camera);
          return;
      }

      // (DPRの定義を削除)
      // const dpr = window.devicePixelRatio || 1;
      const canvasWidth = ctx.canvas.width;  // cssWidth ではなく canvas.width を使用
      const canvasHeight = ctx.canvas.height; // cssHeight ではなく canvas.height を使用

      ctx.save();
      ctx.clearRect(0, 0, canvasWidth, canvasHeight); // 修正

      // ★★★ 修正点: DPRスケーリングを削除 ★★★
      // ctx.scale(dpr, dpr); // 削除

      // ★★★ 修正点: 座標変換を canvas.width/height 基準に変更 ★★★
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.scale(camera.zoom, camera.zoom);
      // (オリジナルスクリプトと同じトランスフォームロジック)
      ctx.translate(-canvasWidth / 2 + camera.x, -canvasHeight / 2 + camera.y);


      // (以降の描画関数は変更なし)
      drawGrid(ctx, camera);
      drawObjects(ctx, objects, camera);
      drawAllSnapPoints(ctx, objects, camera);
      drawDimensions(ctx, dimensions, objects, camera);

      if (mode === 'measure') {
        drawMeasureTool(ctx, measurePoints, mouseWorldPos, camera, objects);
      }

      ctx.restore();
    };

    draw();

  }, [objects, camera, mode, measurePoints, mouseWorldPos, dimensions, canvasRef]);
};