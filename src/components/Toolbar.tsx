'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';

const Toolbar = () => {
  const { undo, redo, history, historyIndex, mode, setMode } = useAppStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleModeToggle = () => {
    setMode(mode === 'measure' ? 'pan' : 'measure');
  };

  const baseButtonClass = "p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const activeButtonClass = "bg-indigo-100 text-indigo-700";

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-md p-2 flex items-center justify-between z-10">
      <div className="flex items-center flex-wrap gap-x-1 md:gap-x-2 gap-y-1">
        {/* Undo/Redo */}
        <button 
          title="元に戻す"
          onClick={undo}
          disabled={!canUndo}
          className={baseButtonClass}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h12a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H7.5"/><path d="m6 12 3-3-3-3"/></svg>
        </button>
        <button 
          title="やり直す" 
          onClick={redo}
          disabled={!canRedo}
          className={baseButtonClass}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h7.5"/><path d="m18 12-3-3 3-3"/></svg>
        </button>

        <div className="border-l h-8 mx-2"></div>

        {/* ★ 計測モード切替ボタン */}
        <button 
          title="2点間計測"
          onClick={handleModeToggle}
          className={`${baseButtonClass} ${mode === 'measure' ? activeButtonClass : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"></line>
            <polyline points="7 7 17 7 17 17"></polyline>
            <line x1="4" y1="20" x2="20" y2="4"></line>
            <circle cx="6.5" cy="17.5" r="2.5"></circle>
            <circle cx="17.5" cy="6.5" r="2.5"></circle>
          </svg>
        </button>

      </div>
    </header>
  );
};

export default Toolbar;
