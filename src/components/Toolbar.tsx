'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';

const Toolbar = () => {
  const { 
    undo, redo, history, historyIndex, mode, setMode, 
    zoomIn, zoomOut, resetView, clearCanvas, togglePalette
  } = useAppStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleModeToggle = () => {
    setMode(mode === 'measure' ? 'pan' : 'measure');
  };

  // Browser-specific actions
  const handlePrint = () => window.print();

  const handleScreenshot = () => {
    // This logic is better implemented in CanvasArea where the canvas ref exists.
    // We can trigger it via a global event or a state flag.
    alert('スクリーンショット機能はCanvasAreaコンポーネントから実装する必要があります。');
  };
  
  const handleShare = async () => {
    const shareData = {
        title: '簡易ダクト設計アプリ',
        text: 'このダクト設計をチェックしてください！',
        url: window.location.href,
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
           await navigator.clipboard.writeText(window.location.href);
           alert('URLをクリップボードにコピーしました');
        }
    } catch (err) {
        console.error('Share failed:', err);
        alert('共有に失敗しました');
    }
  };

  const handleClearCanvas = () => {
    if (window.confirm('すべての部品と寸法を削除します。よろしいですか？')) {
      clearCanvas();
    }
  };

  const baseButtonClass = "p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const activeButtonClass = "bg-indigo-100 text-indigo-700";

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-md p-2 flex items-center justify-between z-10">
      <div className="flex items-center flex-wrap gap-x-1 md:gap-x-2 gap-y-1">
        <button title="パレットを開閉" onClick={togglePalette} className={`${baseButtonClass} md:hidden`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
        </button>

        {/* Undo/Redo */}
        <button title="元に戻す" onClick={undo} disabled={!canUndo} className={baseButtonClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h12a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H7.5"/><path d="m6 12 3-3-3-3"/></svg>
        </button>
        <button title="やり直す" onClick={redo} disabled={!canRedo} className={baseButtonClass}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h7.5"/><path d="m18 12-3-3 3-3"/></svg>
        </button>

        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        {/* Measure Tool */}
        <button title="2点間計測" onClick={handleModeToggle} className={`${baseButtonClass} ${mode === 'measure' ? activeButtonClass : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v16H6.5a2.5 2.5 0 0 1 0-5H20"/><line x1="4" x2="8" y1="15" y2="15"/></svg>
        </button>

        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        {/* Zoom */}
        <button title="ズームイン" onClick={zoomIn} className={baseButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
        </button>
        <button title="ズームアウト" onClick={zoomOut} className={baseButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
        </button>
        <button title="ビューをリセット" onClick={resetView} className={baseButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>
        </button>

        <div className="h-6 w-px bg-gray-300 mx-1"></div>

        {/* Canvas Actions */}
        <button title="キャンバスをクリア" onClick={handleClearCanvas} className={`${baseButtonClass} text-red-500`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        
        {/* Export/Share */}
        <button title="スクリーンショット" onClick={handleScreenshot} className={baseButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </button>
        <button title="共有" onClick={handleShare} className={baseButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" x2="12" y1="2" y2="15"></line></svg>
        </button>
        <button title="印刷" onClick={handlePrint} className={baseButtonClass}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
        </button>
      </div>
    </header>
  );
};

export default Toolbar;