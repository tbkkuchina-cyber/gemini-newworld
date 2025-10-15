'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Point } from '@/lib/types';

interface DimensionModalProps {
  dimension: {p1: Point, p2: Point};
  onApply: (newLength: number) => void;
  onCancel: () => void;
}

const DimensionModal: React.FC<DimensionModalProps> = ({ dimension, onApply, onCancel }) => {
    const initialValue = Math.hypot(dimension.p2.x - dimension.p1.x, dimension.p2.y - dimension.p1.y);
    const [value, setValue] = useState(initialValue.toFixed(1));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (dimension && inputRef.current) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [dimension]);

    const handleApply = () => {
        const newLength = parseFloat(value);
        if (!isNaN(newLength) && newLength > 0) {
            onApply(newLength);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 space-y-4">
                <h3 className="text-lg font-bold">寸法を入力</h3>
                <input 
                    ref={inputRef}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">キャンセル</button>
                    <button onClick={handleApply} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">適用</button>
                </div>
            </div>
        </div>
    );
};

export default DimensionModal;
