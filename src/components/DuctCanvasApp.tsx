'use client';

import { useEffect } from "react";
import CanvasArea from "@/components/CanvasArea";
import ConfirmModal from "@/components/ConfirmModal";
import ContextMenu from "@/components/ContextMenu";
import DimensionModal from "@/components/DimensionModal";
import FittingsModal from "@/components/FittingsModal";
import Palette from "@/components/Palette";
import Toolbar from "@/components/Toolbar";
import { useDuctStoreContext } from "@/lib/store-provider";
import { shallow } from 'zustand/shallow';

const DuctCanvasApp = () => {
  const {
    isConfirmModalOpen,
    confirmModalContent,
    closeConfirmModal,
    loadFittings,
    isContextMenuOpen,
    contextMenuPosition,
    isDimensionModalOpen,
    dimensionModalContent,
    closeDimensionModal,
    isFittingsModalOpen,
  } = useDuctStoreContext((state) => ({
    isConfirmModalOpen: state.isConfirmModalOpen,
    confirmModalContent: state.confirmModalContent,
    closeConfirmModal: state.closeConfirmModal,
    loadFittings: state.loadFittings,
    isContextMenuOpen: state.isContextMenuOpen,
    contextMenuPosition: state.contextMenuPosition,
    isDimensionModalOpen: state.isDimensionModalOpen,
    dimensionModalContent: state.dimensionModalContent,
    closeDimensionModal: state.closeDimensionModal,
    isFittingsModalOpen: state.isFittingsModalOpen,
  }));

  useEffect(() => {
    loadFittings();
  }, [loadFittings]);

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
        isOpen={isConfirmModalOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModalContent.onConfirm}
        title={confirmModalContent.title}
      >
        <p>{confirmModalContent.message}</p>
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
