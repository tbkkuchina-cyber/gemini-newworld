'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';

const ConfirmModal = () => {
    const {
        confirmModal,
        hideConfirmModal,
    } = useAppStore();

    if (!confirmModal.isOpen) {
        return null;
    }

    const handleConfirm = () => {
        confirmModal.onConfirm();
        hideConfirmModal();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col">
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">{confirmModal.title}</h2>
                    <p className="text-gray-600">{confirmModal.message}</p>
                </div>

                 <div className="border-t p-4 flex justify-end bg-gray-50/70 space-x-2">
                    <button onClick={hideConfirmModal} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
                        キャンセル
                    </button>
                    <button onClick={handleConfirm} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700 transition-colors">
                        実行
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
