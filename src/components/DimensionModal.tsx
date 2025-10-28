'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSetAtom } from 'jotai';
// updateStraightDuctLengthAtom をインポート (後で jotai-store.ts に追加)
import { addDimensionAtom, updateStraightDuctLengthAtom } from '@/lib/jotai-store';
import { Dimension, SnapPoint } from '@/lib/types';

interface DimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  // content の型を拡張して、計測距離や更新対象の情報を追加
  content: {
    p1: SnapPoint;
    p2: SnapPoint;
    measuredDistance?: number; // useCanvasInteraction から渡される計測距離
    ductToUpdateId?: number;  // 更新対象の直管ID (あれば)
    lengthToSubtract?: number;// 差し引く脚長 (あれば)
  } | null;
}

const DimensionModal = ({ isOpen, onClose, content }: DimensionModalProps) => {
  const addDimension = useSetAtom(addDimensionAtom);
  // 新しいアトムの setter を取得 (後で jotai-store.ts に追加)
  const updateStraightDuctLength = useSetAtom(updateStraightDuctLengthAtom);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    // モーダルが開かれたとき、または content が変わったときに初期値を設定
    if (content) {
      // content に measuredDistance があればそれを使う、なければ計算
      const initialDist = content.measuredDistance ?? Math.hypot(content.p2.x - content.p1.x, content.p2.y - content.p1.y);
      setDistance(initialDist);
    } else {
      setDistance(0); // content が null ならリセット
    }
  }, [content]); // content が変更されたら再実行

  if (!isOpen || !content) return null;

  // content から ductToUpdateId と lengthToSubtract を取得
  const { p1, p2, ductToUpdateId, lengthToSubtract } = content;
  const isUpdatingDuct = ductToUpdateId !== undefined && lengthToSubtract !== undefined;

  const handleConfirm = () => {
    if (isUpdatingDuct) {
      // --- 直管長更新ロジックを呼び出す ---
      updateStraightDuctLength({
        totalDistance: distance,
        ductToUpdateId: ductToUpdateId,
        lengthToSubtract: lengthToSubtract,
        p1_info: p1, // 移動計算に必要なため snapPoint 情報を渡す
        p2_info: p2,
      });
      // 注意: updateStraightDuctLengthAtom 内で寸法線の追加/更新も行う想定
    } else {
      // --- 従来の寸法線追加ロジック ---
      const newDimension: Dimension = {
        id: `dim-${Date.now()}`,
        p1_objId: p1.objId,
        p1_pointId: p1.pointId,
        p1_pointType: p1.pointType,
        p2_objId: p2.objId,
        p2_pointId: p2.pointId,
        p2_pointType: p2.pointType,
        value: distance, // ユーザーが入力した値を使用
      };
      addDimension(newDimension);
    }
    onClose(); // どちらの場合もモーダルを閉じる
  };

  // モーダルのタイトルとボタンテキストを動的に変更
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
          {/* ラベルを「全長」に変更 */}
          <label htmlFor="distance-input" className="text-sm font-medium">中心線距離 (全長 mm)</label>
          <input
            id="distance-input"
            type="number"
            value={distance.toFixed(1)} // 表示は小数点以下1桁
            onChange={(e) => setDistance(parseFloat(e.target.value) || 0)} // 不正な入力は0として扱う
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
            step="0.1" // 小数点入力に対応
          />
          {/* 更新対象の直管がある場合、計算される直管長を表示（任意） */}
          {isUpdatingDuct && (
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
            // 計算後の直管長がマイナスになる場合はボタンを無効化
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