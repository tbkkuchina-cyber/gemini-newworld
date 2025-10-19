import { useEffect, RefObject } from 'react';
import { useDuctStoreContext } from '@/lib/store-provider';
import { shallow } from 'zustand/shallow';
import { drawGrid, drawObjects, drawConnectors, drawMeasureTool, drawDimensions } from '@/lib/canvas-utils';

export const useCanvas = (canvasRef: RefObject<HTMLCanvasElement>) => {
  const {
    objects,
    camera,
    mode,
    measurePoints,
    mouseWorldPos,
    dimensions,
  } = useDuctStoreContext((state) => ({
    objects: state.objects,
    camera: state.camera,
    mode: state.mode,
    measurePoints: state.measurePoints,
    mouseWorldPos: state.mouseWorldPos,
    dimensions: state.dimensions,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.save();
      // Clear canvas before drawing
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // Draw components
      drawGrid(ctx, camera);
      drawObjects(ctx, objects, camera);
      drawConnectors(ctx, objects, camera);
      drawDimensions(ctx, dimensions, objects, camera);

      if (mode === 'measure') {
        drawMeasureTool(ctx, measurePoints, mouseWorldPos, camera);
      }

      // Restore context
      ctx.restore();
    };

    draw();

  }, [objects, camera, mode, measurePoints, mouseWorldPos, dimensions, canvasRef]);
};
