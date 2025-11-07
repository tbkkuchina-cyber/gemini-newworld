'use client';

import { useEffect } from "react";
import dynamic from 'next/dynamic';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';

// --- すべてのインポートを正しく記述 ---
import CanvasArea from "@/components/CanvasArea";
import ConfirmModal from "@/components/ConfirmModal";
import ContextMenu from "@/components/ContextMenu";
import DimensionModal from "@/components/DimensionModal";
import FittingsModal from "@/components/FittingsModal";
import Toolbar from "@/components/Toolbar"; 

import {
  isClearCanvasModalOpenAtom,
  clearCanvasAtom,
  loadFittingsAtom,
  isContextMenuOpenAtom,
  contextMenuPositionAtom,
  isDimensionModalOpenAtom,
  dimensionModalContentAtom,
  closeDimensionModalAtom,
  notificationAtom
} from "@/lib/jotai-store"; 
// --- 修正ここまで ---

// Palette はクライアントサイドでのみレンダリング
const Palette = dynamic(() => import('@/components/Palette'), { ssr: false });

// --- Notification Component ---
const NotificationDisplay = () => {
    const notification = useAtomValue(notificationAtom);
    if (!notification?.message) { return null; }
    return (
        <div
            key={notification.id}
            className="fixed bottom-4 right-4 z-50 p-3 bg-gray-800 text-white rounded-md shadow-lg animate-fade-in-out"
        >
            {notification.message}
        </div>
    );
};

// --- Main App Component ---
const DuctCanvasApp = () => {
  const [isClearModalOpen, setIsClearModalOpen] = useAtom(isClearCanvasModalOpenAtom);
  const clearCanvas = useSetAtom(clearCanvasAtom);
  const loadFittings = useSetAtom(loadFittingsAtom);
  const isContextMenuOpen = useAtomValue(isContextMenuOpenAtom);
  const contextMenuPosition = useAtomValue(contextMenuPositionAtom);
  const isDimensionModalOpen = useAtomValue(isDimensionModalOpenAtom);
  const dimensionModalContent = useAtomValue(dimensionModalContentAtom);
  const closeDimensionModal = useSetAtom(closeDimensionModalAtom);

  useEffect(() => {
    loadFittings();
  }, [loadFittings]);

  const handleClearConfirm = () => {
    clearCanvas();
    setIsClearModalOpen(false);
  };

  const handleClearClose = () => {
    setIsClearModalOpen(false);
  };

  return (
    // ★★★ 修正点 ★★★
    // h-screen (100vh) を h-full (100%) に変更。
    // (layout.tsx の body が h-full なので、その高さを継承)
    <div className="w-full h-full bg-gray-100 text-gray-800 flex flex-col md:flex-row relative">
      {/* Main Content */}
      {/* ★★★ 修正点 ★★★
          flex-1 (残りのスペース) と overflow-hidden (パレット領域を侵害しない) を設定
      */}
      <main className="flex-1 flex flex-col relative overflow-hidden md:flex-1">
        <Toolbar />
        <CanvasArea />
        <ContextMenu isOpen={isContextMenuOpen} position={contextMenuPosition} />
      </main>

      {/* Sidebar */}
      <Palette />

      {/* Modals */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        onClose={handleClearClose}
        onConfirm={handleClearConfirm}
        title="キャンバスをクリア"
      >
        <p>すべての部品と寸法を削除します。よろしいですか？</p>
      </ConfirmModal>
      <DimensionModal
        isOpen={isDimensionModalOpen}
        onClose={closeDimensionModal}
        content={dimensionModalContent}
      />
      <FittingsModal />

      {/* --- Notification Display --- */}
      <NotificationDisplay />

      {/* Tailwind animation definition */}
      <style jsx global>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateY(10px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-out {
          animation: fadeInOut 3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DuctCanvasApp;