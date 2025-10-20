'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSetAtom } from 'jotai';
import { addDimensionAtom } from '@/lib/jotai-store';
import { Dimension, SnapPoint } from '@/lib/types';

interface DimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: { p1: SnapPoint; p2: SnapPoint } | null;
}

const DimensionModal = ({ isOpen, onClose, content }: DimensionModalProps) => {
  const addDimension = useSetAtom(addDimensionAtom);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (content) {
      const dist = Math.hypot(content.p2.x - content.p1.x, content.p2.y - content.p1.y);
      setDistance(dist);
    }
  }, [content]);

  if (!isOpen || !content) return null;

  const handleConfirm = () => {
    const newDimension: Dimension = {
      id: `dim-${Date.now()}`,
      p1_objId: content.p1.objId,
      p1_pointId: content.p1.pointId,
      p1_pointType: content.p1.pointType,
      p2_objId: content.p2.objId,
      p2_pointId: content.p2.pointId,
      p2_pointType: content.p2.pointType,
      value: distance,
    };
    addDimension(newDimension);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold">寸法線の追加</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        <div className="mb-4 space-y-2">
            <label htmlFor="distance-input" className="text-sm font-medium">中心線距離 (mm)</label>
            <input 
                id="distance-input"
                type="number" 
                value={distance.toFixed(1)} 
                onChange={(e) => setDistance(parseFloat(e.target.value))}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
            />
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">
            キャンセル
          </button>
          <button onClick={handleConfirm} className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700">
            追加
          </button>
        </div>
      </div>
    </div>
  );
};

export default DimensionModal;
