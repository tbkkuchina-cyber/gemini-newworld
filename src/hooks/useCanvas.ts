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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.save();
      // Clear canvas before drawing
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // Apply camera transformations
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-ctx.canvas.width / 2 + camera.x, -ctx.canvas.height / 2 + camera.y);

      // Draw components
      drawGrid(ctx, camera);
      drawObjects(ctx, objects, camera);
      drawAllSnapPoints(ctx, objects, camera);
      drawDimensions(ctx, dimensions, objects);

      if (mode === 'measure') {
        drawMeasureTool(ctx, measurePoints, mouseWorldPos);
      }

      // Restore context
      ctx.restore();
    };

    draw();

  }, [objects, camera, mode, measurePoints, mouseWorldPos, dimensions, canvasRef]);
};
