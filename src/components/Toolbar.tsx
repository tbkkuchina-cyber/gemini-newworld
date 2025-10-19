'use client';

import { useDuctStoreContext, DuctStoreContext } from "@/lib/store-provider";
import { Undo, Redo, ZoomIn, ZoomOut, RefreshCw, Trash2, Ruler } from 'lucide-react';
import { useContext } from 'react';

const Toolbar = () => {
  const storeApi = useContext(DuctStoreContext);
  if (!storeApi) {
    throw new Error('Toolbar must be used within a DuctStoreProvider');
  }
  const { undo, redo, pastStates = [], futureStates = [] } = storeApi as any || {};
  const {
    camera,
    setCamera,
    openConfirmModal,
    clearCanvas,
    mode,
    setMode,
  } = useDuctStoreContext((state) => ({
    camera: state.camera,
    setCamera: state.setCamera,
    openConfirmModal: state.openConfirmModal,
    clearCanvas: state.clearCanvas,
    mode: state.mode,
    setMode: state.setMode,
  }));

  const handleZoomIn = () => setCamera({ zoom: camera.zoom * 1.2 });
  const handleZoomOut = () => setCamera({ zoom: camera.zoom / 1.2 });
  const handleResetView = () => setCamera({ x: 0, y: 0, zoom: 1 });

  const handleClearCanvas = () => {
    openConfirmModal({
      title: 'キャンバスをクリア',
      message: 'すべての部品と寸法を削除します。よろしいですか？',
      onConfirm: clearCanvas,
    });
  };

  const handleToggleMeasureMode = () => {
    setMode(mode === 'measure' ? 'pan' : 'measure');
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-md p-2 flex items-center justify-between z-10">
      <div className="flex items-center flex-wrap gap-x-1 md:gap-x-2 gap-y-1">
        {/* History */}
        <button 
          onClick={() => undo()} 
          disabled={pastStates.length === 0}
          title="元に戻す"
          className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Undo size={20} />
        </button>
        <button 
          onClick={() => redo()} 
          disabled={futureStates.length === 0}
          title="やり直す"
          className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Redo size={20} />
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