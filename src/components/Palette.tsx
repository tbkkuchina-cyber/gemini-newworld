'use client';

import { useDuctStoreContext } from "@/lib/store-provider";
import PaletteItem from "./PaletteItem";
import { StraightDuct, DuctPartType } from "@/lib/types";
import { useEffect, useState } from "react";

const Palette = () => {
  const { fittings, addObject, openFittingsModal } = useDuctStoreContext((state) => ({
    fittings: state.fittings,
    addObject: state.addObject,
    openFittingsModal: state.openFittingsModal,
  }));
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  const handleAddStraightDuct = () => {
    // This will add the duct to the center of the viewport later.
    // For now, adds at (0,0).
    const newDuct: StraightDuct = {
      id: Date.now(),
      groupId: Date.now(),
      type: DuctPartType.Straight,
      x: 0,
      y: 0,
      data: {
        start: { x: 0, y: 0 },
        end: { x: 400, y: 0 },
        length: 400,
        diameter: 100,
      },
      name: '直管', // Add a default name
      rotation: 0,
      diameter: 100, // Added here
      systemName: 'SA-1', // Default or from input
      isSelected: false,
      isFlipped: false,
    };
    addObject(newDuct);
  };

  return (
    <aside id="palette" className="w-full md:w-64 bg-white shadow-lg p-4 overflow-y-auto order-last md:order-first">
      <div className="mb-6">
        <div className="space-y-2">
          <div>
            <label htmlFor="system-name" className="text-sm font-medium">系統名</label>
            <input type="text" id="system-name" defaultValue="SA-1" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label htmlFor="custom-diameter" className="text-sm font-medium">直径 (mm)</label>
            <input type="number" id="custom-diameter" defaultValue="100" step="25" min="25" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={handleAddStraightDuct} className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors">
            直管を追加
          </button>
        </div>
      </div>

      <div className="mb-6 border-t pt-4">
        <button onClick={openFittingsModal} className="w-full bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
          継手管理
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {isClient && Object.entries(fittings).map(([category, items]) => (
          items.filter(item => item.visible).map(item => (
            <PaletteItem key={item.id} item={item} type={category} />
          ))
        ))}
      </div>
    </aside>
  );
};

export default Palette;