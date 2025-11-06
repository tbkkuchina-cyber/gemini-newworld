import { useEffect, RefObject } from 'react';
import { useAtomValue } from 'jotai';
import {
  objectsAtom,
  cameraAtom,
  modeAtom,
  measurePointsAtom,
  mouseWorldPosAtom,
  // ★★★ 修正点: allDimensionsAtom をインポート ★★★
  allDimensionsAtom
} from '@/lib/jotai-store'; 
import { drawGrid, drawObjects, drawAllSnapPoints, drawMeasureTool, drawDimensions } from '@/lib/canvas-utils'; 

export const useCanvas = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const objects = useAtomValue(objectsAtom);
  const camera = useAtomValue(cameraAtom);
  const mode = useAtomValue(modeAtom);
  const measurePoints = useAtomValue(measurePointsAtom);
  const mouseWorldPos = useAtomValue(mouseWorldPosAtom);
  
  // ★★★ 修正点: dimensionsAtom -> allDimensionsAtom に変更 ★★★
  const dimensions = useAtomValue(allDimensionsAtom);

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

      const canvasWidth = ctx.canvas.width;  
      const canvasHeight = ctx.canvas.height; 

      ctx.save();
      ctx.clearRect(0, 0, canvasWidth, canvasHeight); 
      
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-canvasWidth / 2 + camera.x, -canvasHeight / 2 + camera.y);

      drawGrid(ctx, camera);
      drawObjects(ctx, objects, camera);
      drawAllSnapPoints(ctx, objects, camera);
      
      // (dimensions には自動計算された赤い線と、手動の青い線の両方が入る)
      drawDimensions(ctx, dimensions, objects, camera);

      if (mode === 'measure') {
        drawMeasureTool(ctx, measurePoints, mouseWorldPos, camera, objects);
      }

      ctx.restore();
    };

    draw();

  // ★★★ 修正点: 依存配列を allDimensionsAtom (の実体は dimensions) に変更 ★★★
  }, [objects, camera, mode, measurePoints, mouseWorldPos, dimensions, canvasRef]);
};