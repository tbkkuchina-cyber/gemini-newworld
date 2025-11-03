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
      // ★★★ 修正点: DPRスケーリングを削除 ★★★
      // const dpr = window.devicePixelRatio || 1; // 削除
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width; // * dpr; // 削除 (CSSピクセルと内部解像度を一致させる)
      canvas.height = rect.height; // * dpr; // 削除
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex-1 bg-gray-200 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
};

export default CanvasArea;