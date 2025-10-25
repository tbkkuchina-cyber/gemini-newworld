'use client';

import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, children }: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        <div className="mb-4">{children}</div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">
            キャンセル
          </button>
          <button onClick={onConfirm} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700">
            実行
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
