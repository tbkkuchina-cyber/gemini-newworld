'use client';

import { useRef, useEffect } from 'react';
import { useCanvas } from '@/hooks/useCanvas';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';

const CanvasArea = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvas(canvasRef);
  useCanvasInteraction(canvasRef);

  // Resize observer to handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width; 
      canvas.height = rect.height;
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    // ★★★ 修正点 ★★★
    // touch-action-none を追加し、ホイールやピンチ操作が
    // ブラウザに奪われるのを防ぎます。
    <div className="flex-1 bg-gray-200 relative overflow-hidden touch-action-none">
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
};

export default CanvasArea;