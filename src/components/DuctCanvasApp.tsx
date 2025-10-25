'use client';

import { useEffect } from "react";
import dynamic from 'next/dynamic';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
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
  closeDimensionModalAtom
} from "@/lib/jotai-store";

const Palette = dynamic(() => import('@/components/Palette'), { ssr: false });

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
    <div className="w-screen h-screen bg-gray-100 text-gray-800 flex flex-col md:flex-row">
      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
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
    </div>
  );
};

export default DuctCanvasApp;
