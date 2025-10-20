'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { FittingItem, DuctPartType } from "@/lib/types";
import {
  isFittingsModalOpenAtom,
  closeFittingsModalAtom,
  fittingsAtom,
  setFittingsAtom,
  saveFittingsAtom
} from '@/lib/jotai-store';

const FittingsModal = () => {
  const isOpen = useAtomValue(isFittingsModalOpenAtom);
  const onClose = useSetAtom(closeFittingsModalAtom);
  const globalFittings = useAtomValue(fittingsAtom);
  const setFittings = useSetAtom(setFittingsAtom);
  const saveFittings = useSetAtom(saveFittingsAtom);

  const [localFittings, setLocalFittings] = useState(globalFittings);

  useEffect(() => {
    setLocalFittings(globalFittings);
  }, [globalFittings, isOpen]);

  if (!isOpen) return null;

  const getCategoryHeaders = (items: FittingItem[]): string[] => {
    const headers = new Set<string>(['name', 'type']);
    items.forEach(item => {
        Object.keys(item.data).forEach(key => headers.add(key));
    });
    return Array.from(headers);
  };

  const createDefaultFittingItem = (category: string): FittingItem => {
    const baseItem = {
      id: `${category}-${Date.now()}`,
      name: 'New',
      visible: true,
    };

    switch (category) {
      case '90°エルボ':
      case '45°エルボ':
      case '可変角度エルボ':
        return {
          ...baseItem,
          type: DuctPartType.Elbow,
          data: { center: { x: 0, y: 0 }, startAngle: 0, endAngle: 90, radius: 100, diameter: 100, angle: 90 },
        };
      case 'T字管レジューサー':
      case 'Y字管レジューサー':
        return {
          ...baseItem,
          type: DuctPartType.Branch,
          data: { mainLength: 200, mainDiameter: 100, mainOutletDiameter: 100, branchLength: 100, branchDiameter: 100, intersectionOffset: 0, angle: 0 },
        };
      case 'レジューサー':
        return {
          ...baseItem,
          type: DuctPartType.Reducer,
          data: { start: { x: 0, y: 0 }, end: { x: 150, y: 0 }, startDiameter: 100, endDiameter: 80, length: 150 },
        };
      case 'ダンパー':
        return {
          ...baseItem,
          type: DuctPartType.Straight,
          data: { length: 100, diameter: 100 },
        };
      case 'キャップ':
        return {
          ...baseItem,
          type: DuctPartType.Cap,
          data: { position: { x: 0, y: 0 }, diameter: 100 },
        };
      case 'T字管':
        return {
          ...baseItem,
          type: DuctPartType.Tee,
          data: { mainConnection: { x: 0, y: 0 }, branchConnection: { x: 0, y: 0 }, mainDiameter: 100, branchDiameter: 100, mainLength: 200, branchLength: 200 },
        };
      default:
        return {
          ...baseItem,
          type: DuctPartType.Straight,
          data: { start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, diameter: 100, length: 200 },
        };
    }
  };

  const handleInputChange = (category: string, index: number, prop: string, value: any) => {
    const newFittings = { ...localFittings };
    const item = { ...newFittings[category][index] };
    if (prop === 'name' || prop === 'visible' || prop === 'type') {
      (item as any)[prop] = value;
    } else if (prop === 'data') { // Handle data as a whole object
      item.data = value;
    } else {
      // Assume it's a data property
      item.data = { ...item.data, [prop]: value };
    }
    newFittings[category][index] = item;
    setLocalFittings(newFittings);
  };

  const handleAddRow = (category: string) => {
    const newFittings = { ...localFittings };
    const newItem: FittingItem = createDefaultFittingItem(category);
    newFittings[category] = [...newFittings[category], newItem];
    setLocalFittings(newFittings);
  };

  const handleDeleteRow = (category: string, index: number) => {
    const newFittings = { ...localFittings };
    newFittings[category].splice(index, 1);
    setLocalFittings(newFittings);
  };

  const handleSaveChanges = () => {
    setFittings(localFittings);
    saveFittings();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-2xl font-bold">継手管理</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2">
          {Object.entries(localFittings).map(([category, items]) => {
            const headers = getCategoryHeaders(items);
            return (
              <div key={category} className="mb-6">
                <h3 className="text-xl font-semibold mb-3 border-b pb-2">{category}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left table-auto">
                    <thead>
                      <tr>
                        <th className="p-2 text-sm font-semibold">Name</th>
                        <th className="p-2 text-sm font-semibold">Type</th>
                        <th className="p-2 text-sm font-semibold">Data (JSON)</th>
                        <th className="p-2 text-sm font-semibold">Visible</th>
                        <th className="p-2 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={item.name} 
                              onChange={(e) => handleInputChange(category, index, 'name', e.target.value)} 
                              className="w-full p-1 border rounded min-w-[60px]" 
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={item.type} 
                              readOnly 
                              className="w-full p-1 border rounded min-w-[60px] bg-gray-100" 
                            />
                          </td>
                          <td className="p-2">
                            <textarea
                              value={JSON.stringify(item.data, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsedData = JSON.parse(e.target.value);
                                  handleInputChange(category, index, 'data', parsedData);
                                } catch (error) {
                                  console.error("Invalid JSON for data:", error);
                                }
                              }}
                              className="w-full p-1 border rounded min-w-[150px] h-20"
                            />
                          </td>
                          <td className="p-2 text-center">
                              <input type="checkbox" checked={item.visible} onChange={(e) => handleInputChange(category, index, 'visible', e.target.checked)} className="h-5 w-5 rounded" />
                          </td>
                          <td className="p-2">
                            <button onClick={() => handleDeleteRow(category, index)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={20} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                 <button onClick={() => handleAddRow(category)} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm">
                  <Plus size={16} className="inline-block mr-1" />
                  Add Row
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t pt-4 flex justify-end space-x-2">
          <button onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">
            キャンセル
          </button>
          <button onClick={handleSaveChanges} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-indigo-700 transition-colors">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default FittingsModal;
