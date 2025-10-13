'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { PaletteItemData } from '@/lib/types';
import PaletteIcon from '@/components/PaletteIcon';

const Palette = () => {
  const { addObject, camera, fittings, toggleFittingsModal } = useAppStore();
  const [systemName, setSystemName] = useState('SA-1');
  const [diameter, setDiameter] = useState(100);

  const visibleFittings = useMemo(() => {
    return Object.values(fittings).flat().filter(fitting => fitting.visible);
  }, [fittings]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: PaletteItemData) => {
    const dataToTransfer = {
      ...item,
      defaultOptions: {
        ...item.defaultOptions,
        diameter: diameter > 0 ? diameter : item.defaultOptions.diameter,
        systemName: systemName || item.defaultOptions.systemName,
      }
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dataToTransfer));
  };

  const handleAddClick = () => {
    if (diameter > 0) {
      addObject('StraightDuct', { 
        systemName,
        diameter,
        length: 200, // ★ 400から200に変更
        x: camera.x,
        y: camera.y,
      });
    }
  };

  return (
    <aside className="w-full md:w-64 bg-white shadow-lg p-4 flex flex-col flex-shrink-0 order-first md:order-last">
      <div className="mb-6 border-b pb-4">
        <div className="space-y-2">
          <div><input type="text" value={systemName} onChange={(e) => setSystemName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="系統名"/></div>
          <div><input type="number" value={diameter} onChange={(e) => setDiameter(parseInt(e.target.value, 10))} step="25" min="25" className="w-full p-2 border rounded-md" placeholder="直径 (mm)"/></div>
          <button onClick={handleAddClick} className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700">直管を追加</button>
        </div>
      </div>
      <div className="mb-6 border-b pb-4">
         <button onClick={toggleFittingsModal} className="w-full bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">継手管理</button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2 h-44 md:h-auto md:overflow-visible">
        {visibleFittings.map((item) => (
          <div 
            key={item.id} 
            className="p-2 border rounded-md shadow-sm cursor-grab bg-gray-50 hover:bg-indigo-100 flex items-center justify-center"
            draggable={true} 
            onDragStart={(e) => handleDragStart(e, item)}
          >
            <PaletteIcon item={item} />
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Palette;
