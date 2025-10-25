'use client';

import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { ZoomIn, ZoomOut, RefreshCw, Trash2, Ruler, RotateCcw, RotateCw } from 'lucide-react';
import { 
  cameraAtom, 
  setCameraAtom, 
  isClearCanvasModalOpenAtom, 
  modeAtom,
  undoAtom,
  redoAtom,
  canUndoAtom,
  canRedoAtom
} from '@/lib/jotai-store';

const Toolbar = () => {
  const [mode, setMode] = useAtom(modeAtom);
  const camera = useAtomValue(cameraAtom);
  const setCamera = useSetAtom(setCameraAtom);
  const setIsClearModalOpen = useSetAtom(isClearCanvasModalOpenAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);

  const handleZoomIn = () => setCamera({ zoom: camera.zoom * 1.2 });
  const handleZoomOut = () => setCamera({ zoom: camera.zoom / 1.2 });
  const handleResetView = () => setCamera({ x: 0, y: 0, zoom: 1 });

  const handleClearCanvas = () => {
    setIsClearModalOpen(true);
  };

  const handleToggleMeasureMode = () => {
    setMode(mode === 'measure' ? 'pan' : 'measure');
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-md p-2 flex items-center justify-between z-10">
      <div className="flex items-center flex-wrap gap-x-1 md:gap-x-2 gap-y-1">
        {/* History */}
        <button onClick={undo} title="元に戻す" disabled={!canUndo} className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <RotateCcw size={20} />
        </button>
        <button onClick={redo} title="やり直す" disabled={!canRedo} className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <RotateCw size={20} />
        </button>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* View Controls */}
        <button onClick={handleZoomIn} title="ズームイン" className="p-2 rounded-md hover:bg-gray-200">
          <ZoomIn size={20} />
        </button>
        <button onClick={handleZoomOut} title="ズームアウト" className="p-2 rounded-md hover:bg-gray-200">
          <ZoomOut size={20} />
        </button>
        <button onClick={handleResetView} title="ビューをリセット" className="p-2 rounded-md hover:bg-gray-200">
          <RefreshCw size={20} />
        </button>

        <div className="h-6 w-px bg-gray-300"></div>

        {/* Tools */}
        <button 
          onClick={handleToggleMeasureMode} 
          title="2点間計測" 
          className={`p-2 rounded-md hover:bg-gray-200 ${mode === 'measure' ? 'bg-indigo-200' : ''}`}
        >
          <Ruler size={20} />
        </button>

        <div className="h-6 w-px bg-gray-300"></div>

        <button onClick={handleClearCanvas} title="キャンバスをクリア" className="p-2 rounded-md hover:bg-gray-200 text-red-500">
          <Trash2 size={20} />
        </button>

      </div>
    </header>
  );
};

export default Toolbar;