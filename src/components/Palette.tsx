'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import PaletteItem from "./PaletteItem";
import { StraightDuct, DuctPartType } from "@/lib/types";
import { fittingsAtom, addObjectAtom, openFittingsModalAtom, pendingActionAtom } from '@/lib/jotai-store';

const Palette = () => {
  const fittings = useAtomValue(fittingsAtom);
  const setPendingAction = useSetAtom(pendingActionAtom);
  const openFittingsModal = useSetAtom(openFittingsModalAtom);

  const handleAddStraightDuct = () => {
    setPendingAction('add-straight-duct-at-center');
  };

  return (
    <aside 
      id="palette" 
      // ★★★ 修正点 ★★★
      // h-80 (320pxの固定高) と shrink-0 (縮小しない) を設定
      // md:h-auto でデスクトップ表示時は高さをリセット
      className="w-full h-80 shrink-0 md:h-auto md:w-64 md:shrink-0 bg-white shadow-lg p-4 overflow-y-auto order-last md:order-first"
    >
      <div className="mb-6">
        <label htmlFor="system-name" className="text-sm font-medium">系統名</label>
        <input type="text" id="system-name" defaultValue="SA-1" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="mb-4">
        <label htmlFor="custom-diameter" className="text-sm font-medium">直径 (mm)</label>
        <input type="number" id="custom-diameter" defaultValue="100" step="25" min="25" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" />
      </div>
      <button onClick={handleAddStraightDuct} className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors mb-6">
        直管を追加
      </button>

      <div className="mb-6 border-t pt-4">
        <button onClick={() => openFittingsModal()} className="w-full bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
          継手管理
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(fittings)
            .sort(([catA], [catB]) => catA.localeCompare(catB))
            .flatMap(([category, items]) =>
              items
                .filter((item) => item.visible)
                .map((item) => <PaletteItem key={item.id} item={item} type={category} />)
            )}
      </div>
    </aside>
  );
};

export default Palette;