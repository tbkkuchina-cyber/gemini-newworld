'use client';

// ★★★ 修正点: useEffect, useState, useRef をインポート ★★★
import { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useSetAtom } from 'jotai';
import { addDimensionAtom, updateStraightDuctLengthAtom } from '@/lib/jotai-store';
import { Dimension, SnapPoint } from '@/lib/types';

interface DimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: {
    p1: SnapPoint;
    p2: SnapPoint;
    measuredDistance?: number; 
    ductToUpdateId?: number;  
    lengthToSubtract?: number;
  } | null;
}

const DimensionModal = ({ isOpen, onClose, content }: DimensionModalProps) => {
  const addDimension = useSetAtom(addDimensionAtom);
  const updateStraightDuctLength = useSetAtom(updateStraightDuctLengthAtom);
  
  // ★★★ 修正点: 内部の数値ステートと、入力欄用の文字列ステートを分離 ★★★
  const [distance, setDistance] = useState(0); // 内部計算用の数値
  const [inputValue, setInputValue] = useState(""); // 入力欄表示用の文字列

  const inputRef = useRef<HTMLInputElement>(null);

  // ★★★ 修正点: モーダルが開かれた/内容が変わった時に両方のステートを初期化 ★★★
  useEffect(() => {
    if (content) {
      const initialDist = content.measuredDistance ?? Math.hypot(content.p2.x - content.p1.x, content.p2.y - content.p1.y);
      setDistance(initialDist); // 数値ステートを更新
      setInputValue(initialDist.toFixed(1)); // 文字列ステートを更新
    } else {
      setDistance(0); 
      setInputValue("0.0");
    }
  }, [content]); // content が変わった時だけ実行

  // ★★★ 修正点: フォーカスロジックを isOpen 変更時のみに分離 (setTimeout を維持) ★★★
  useEffect(() => {
    if (isOpen) {
      // 0msのsetTimeoutを使い、DOMの更新（inputの描画）を待ってから実行
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0); 
      
      return () => clearTimeout(timer); // クリーンアップ
    }
  }, [isOpen]); 


  if (!isOpen || !content) return null;

  const { p1, p2, ductToUpdateId, lengthToSubtract } = content;
  const isUpdatingDuct = ductToUpdateId !== undefined && lengthToSubtract !== undefined;

  // (handleConfirm は変更なし - `distance` (数値) を使うため正しい)
  const handleConfirm = () => {
    if (isUpdatingDuct) {
      updateStraightDuctLength({
        totalDistance: distance,
        ductToUpdateId: ductToUpdateId,
        lengthToSubtract: lengthToSubtract,
        p1_info: p1, 
        p2_info: p2,
      });
    } else {
      const newDimension: Dimension = {
        id: `dim-${Date.now()}`,
        p1_objId: p1.objId,
        p1_pointId: p1.pointId,
        p1_pointType: p1.pointType,
        p2_objId: p2.objId,
        p2_pointId: p2.pointId,
        p2_pointType: p2.pointType,
        value: distance, 
      };
      addDimension(newDimension);
    }
    onClose(); 
  };
  
  // (handleKeyDown は変更なし)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (isUpdatingDuct && (distance - lengthToSubtract < 0)) {
            return;
        }
        handleConfirm();
    }
  };


  const modalTitle = isUpdatingDuct ? '直管長の再計算・更新' : '寸法線の追加';
  const confirmButtonText = isUpdatingDuct ? '計算して更新' : '追加';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold">{modalTitle}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        <div className="mb-4 space-y-2">
          <label htmlFor="distance-input" className="text-sm font-medium">中心線距離 (全長 mm)</label>
          <input
            ref={inputRef}
            id="distance-input"
            type="number"
            
            // ★★★ 修正点: `value` を `inputValue` (文字列) にバインド ★★★
            value={inputValue} 

            // ★★★ 修正点: `onChange` で両方のステートを更新 ★★★
            onChange={(e) => {
                const rawValue = e.target.value;
                setInputValue(rawValue); // 文字列ステートを更新 (例: "100")
                setDistance(parseFloat(rawValue) || 0); // 数値ステートを更新 (例: 100)
            }} 
            onKeyDown={handleKeyDown} 
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
            step="0.1" 
          />
          {isUpdatingDuct && (
            // (表示ロジックは `distance` (数値) を使うため変更なし)
            <p className="text-sm text-gray-600 mt-1">
              計算後の直管長: {(distance - lengthToSubtract).toFixed(1)} mm
              {(distance - lengthToSubtract < 0) && <span className="text-red-500 ml-2">(エラー: マイナス値)</span>}
            </p>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className={`font-semibold py-2 px-4 rounded-md transition-colors ${
              isUpdatingDuct
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            disabled={isUpdatingDuct && (distance - lengthToSubtract < 0)}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DimensionModal;