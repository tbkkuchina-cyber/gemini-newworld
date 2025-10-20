'use client';

import { useDuctStoreContext } from '@/lib/store-provider';
import { RotateCw, FlipHorizontal, Trash2, Link2Off } from 'lucide-react';
import { DuctPartType } from '@/lib/types';

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
}

const ContextMenu = ({ isOpen, position }: ContextMenuProps) => {
  const {
    deleteSelectedObject,
    rotateSelectedObject,
    flipSelectedObject,
    disconnectSelectedObject,
    selectedObject,
    objects,
  } = useDuctStoreContext((state) => ({
    deleteSelectedObject: state.deleteSelectedObject,
    rotateSelectedObject: state.rotateSelectedObject,
    flipSelectedObject: state.flipSelectedObject,
    disconnectSelectedObject: state.disconnectSelectedObject,
    selectedObject: state.objects.find(o => o.id === state.selectedObjectId),
    objects: state.objects,
  }));

  if (!isOpen || !selectedObject) return null;

  const isFlippable = selectedObject.type === DuctPartType.Elbow || 
    selectedObject.type === DuctPartType.Branch || 
    selectedObject.type === DuctPartType.Reducer;

  const isInGroup = objects.some(o => o.id !== selectedObject.id && o.groupId === selectedObject.groupId);

  return (
    <div
      className="absolute bg-white shadow-lg rounded-md p-1 flex items-center space-x-1 z-20"
      style={{ left: position.x, top: position.y }}
    >
      <button onClick={rotateSelectedObject} title="回転 (R)" className="p-2 rounded-md hover:bg-gray-200">
        <RotateCw size={20} />
      </button>
      <button onClick={flipSelectedObject} title="反転" className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isFlippable}>
        <FlipHorizontal size={20} />
      </button>
      <button onClick={deleteSelectedObject} title="削除 (Delete)" className="p-2 rounded-md hover:bg-gray-200 text-red-600">
        <Trash2 size={20} />
      </button>
      <button onClick={disconnectSelectedObject} title="接合を解除" className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isInGroup}>
        <Link2Off size={20} />
      </button>
    </div>
  );
};

export default ContextMenu;
