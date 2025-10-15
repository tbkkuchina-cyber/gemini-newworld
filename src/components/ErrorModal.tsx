'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';

const ErrorModal = () => {
    const {
        errorModal,
        hideErrorModal,
    } = useAppStore();

    if (!errorModal.isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col">
                <div className="flex justify-between items-center border-b p-4">
                    <h2 className="text-xl font-bold text-red-600">{errorModal.title}</h2>
                    <button onClick={hideErrorModal} className="p-2 rounded-full hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-6 text-gray-700">
                    <p>{errorModal.message}</p>
                </div>

                 <div className="border-t p-4 flex justify-end bg-gray-50/70">
                    <button onClick={hideErrorModal} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-indigo-700 transition-colors">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;
