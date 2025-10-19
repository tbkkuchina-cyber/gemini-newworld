'use client';

import { useDuctStoreContext } from "@/lib/store-provider";
import { FittingItem } from "@/lib/types";
import { X, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const FittingsModal = () => {
  const {
    isOpen,
    onClose,
    fittings: globalFittings,
    setFittings,
    saveFittings,
  } = useDuctStoreContext((state) => ({
    isOpen: state.isFittingsModalOpen,
    onClose: state.closeFittingsModal,
    fittings: state.fittings,
    setFittings: state.setFittings,
    saveFittings: state.saveFittings,
  }));

  const [localFittings, setLocalFittings] = useState(globalFittings);

  useEffect(() => {
    setLocalFittings(globalFittings);
  }, [globalFittings, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (category: string, index: number, prop: keyof FittingItem, value: any) => {
    const newFittings = { ...localFittings };
    const item = { ...newFittings[category][index] };
    (item as any)[prop] = value;
    newFittings[category][index] = item;
    setLocalFittings(newFittings);
  };

  const handleAddRow = (category: string) => {
    const newFittings = { ...localFittings };
    const newItem: FittingItem = {
      id: `${category}-${Date.now()}`,
      name: 'New',
      diameter: 100,
      visible: true,
    };
    newFittings[category] = [...newFittings[category], newItem];
    setLocalFittings(newFittings);
  };

  const handleDeleteRow = (category: string, index: number) => {
    const newFittings = { ...localFittings };
    newFittings[category].splice(index, 1);
    setLocalFittings(newFittings);
  };

  const getCategoryHeaders = (items: FittingItem[]): (keyof FittingItem)[] => {
    const headers = new Set<keyof FittingItem>(['name', 'diameter']);
    items.forEach(item => {
        Object.keys(item).forEach(key => headers.add(key as keyof FittingItem));
    });
    headers.delete('id');
    headers.delete('visible');
    return Array.from(headers);
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
                        {headers.map(h => <th key={h} className="p-2 text-sm font-semibold">{h}</th>)}
                        <th className="p-2 text-sm font-semibold">Visible</th>
                        <th className="p-2 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className="border-t">
                          {headers.map(header => (
                            <td key={header} className="p-2">
                              {typeof item[header] === 'boolean' ? (
                                <input
                                  type="checkbox"
                                  checked={item[header] as boolean}
                                  onChange={(e) => handleInputChange(category, index, header, e.target.checked)}
                                  className="h-5 w-5 rounded"
                                />
                              ) : (
                                <input 
                                  type={typeof item[header] === 'number' ? 'number' : 'text'} 
                                  value={item[header] || ''} 
                                  onChange={(e) => handleInputChange(category, index, header, typeof item[header] === 'number' ? parseFloat(e.target.value) : e.target.value)} 
                                  className="w-full p-1 border rounded min-w-[60px]" 
                                />
                              )}
                            </td>
                          ))}
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
