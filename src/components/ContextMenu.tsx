'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose }) => {
  const { 
    selectedObjectId,
    deleteObject,
    rotateSelectedObject,
    flipSelectedObject,
    disconnectObject, // ★ 連結解除アクションを取得
  } = useAppStore();

  // 各アクションのハンドラ
  const handleAction = (action: () => void) => {
    action();
    // 削除以外はメニューを閉じないでおく
  };

  const handleDelete = () => {
    if (selectedObjectId !== null) {
      deleteObject(selectedObjectId);
    }
    onClose();
  };

  const handleDisconnect = () => {
    if (selectedObjectId !== null) {
      disconnectObject(selectedObjectId);
    }
    onClose();
  };

  return (
    <div 
      className="absolute bg-white shadow-lg rounded-md p-1 flex items-center space-x-1 z-20" 
      style={{ left: x, top: y, transform: 'translateX(-50%)' }}
    >
      {/* 回転ボタン */}
      <button onClick={() => handleAction(rotateSelectedObject)} title="回転" className="p-2 rounded-md hover:bg-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5A10 10 0 0 1 12 2a10 10 0 0 1 10 9.5"/><path d="M22 12.5a10 10 0 0 1-10 9.5a10 10 0 0 1-10-9.5"/></svg>
      </button>

      {/* 反転ボタン */}
      <button onClick={() => handleAction(flipSelectedObject)} title="反転" className="p-2 rounded-md hover:bg-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 12h18"/><path d="m7 22-4-4 4-4"/><path d="M21 12H3"/></svg>
      </button>

      {/* 連結解除ボタン */}
      <button onClick={handleDisconnect} title="連結解除" className="p-2 rounded-md hover:bg-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></svg>
      </button>

      {/* 削除ボタン */}
      <button onClick={handleDelete} title="削除" className="p-2 rounded-md hover:bg-gray-200 text-red-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    </div>
  );
};

export default ContextMenu;