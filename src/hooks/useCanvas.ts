import { useEffect, RefObject } from 'react';
import { useAtomValue } from 'jotai';
import {
  objectsAtom,
  cameraAtom,
  modeAtom,
  measurePointsAtom,
  mouseWorldPosAtom,
  dimensionsAtom
} from '@/lib/jotai-store'; // Removed leading space
// drawMeasureTool の import を確認
import { drawGrid, drawObjects, drawAllSnapPoints, drawMeasureTool, drawDimensions } from '@/lib/canvas-utils'; // Removed leading space

export const useCanvas = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const objects = useAtomValue(objectsAtom);
  const camera = useAtomValue(cameraAtom);
  const mode = useAtomValue(modeAtom);
  const measurePoints = useAtomValue(measurePointsAtom);
  const mouseWorldPos = useAtomValue(mouseWorldPosAtom);
  const dimensions = useAtomValue(dimensionsAtom);

  useEffect(() => {
    // console.log('[useCanvas] useEffect triggered. Camera:', camera);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // --- 追加: useEffect の最初に camera が有効かチェック ---
    if (!camera || typeof camera.zoom !== 'number') {
        console.warn('[useCanvas] Skipping draw in useEffect because camera is not ready yet.', camera);
        return; // camera が無効ならここで処理を中断
    }
    // ----------------------------------------------------

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // console.log('[useCanvas] draw() called. Camera:', camera);
      // --- draw 関数内のチェックも維持 ---
      if (!camera || typeof camera.zoom !== 'number') {
          console.error('[useCanvas] draw() called but camera is invalid!', camera);
          return;
      }
      // ------------------------------------

      ctx.save();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-ctx.canvas.width / 2 + camera.x, -ctx.canvas.height / 2 + camera.y);

      drawGrid(ctx, camera);
      drawObjects(ctx, objects, camera);
      drawAllSnapPoints(ctx, objects, camera);
      // drawDimensions は正しく camera を受け取っているはず
      drawDimensions(ctx, dimensions, objects, camera);

      if (mode === 'measure') {
        // --- FIX: Pass camera AND objects arguments ---
        drawMeasureTool(ctx, measurePoints, mouseWorldPos, camera, objects);
        // --------------------------------------------
      }

      ctx.restore();
    };

    // useEffect の最後で draw を呼び出す (camera チェックは既に行った)
    draw();

  }, [objects, camera, mode, measurePoints, mouseWorldPos, dimensions, canvasRef]);
};