'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState, useMemo } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { FittingItem, Fittings, DuctPartType } from "@/lib/types";
import {
  isFittingsModalOpenAtom,
  closeFittingsModalAtom,
  fittingsAtom,
  setFittingsAtom,
  saveFittingsAtom
} from '@/lib/jotai-store';

// Helper function to generate the name based on diameters
const generateNameFromDiameters = (item: FittingItem): string => {
    const d1 = item.diameter || 0;
    const d2 = (item as any).diameter2 || 0;
    const d3 = (item as any).diameter3 || 0;

    if (item.type === DuctPartType.TeeReducer || item.type === DuctPartType.YBranchReducer) {
        return `D${d1}-${d2}-${d3}`;
    }
    if (item.type === DuctPartType.Reducer) {
        return `D${d1}-${d2}`;
    }
    return `D${d1}`;
};

const FittingsModal = () => {
  const isOpen = useAtomValue(isFittingsModalOpenAtom);
  const onClose = useSetAtom(closeFittingsModalAtom);
  const globalFittings = useAtomValue(fittingsAtom);
  const setFittings = useSetAtom(setFittingsAtom);
  const saveFittings = useSetAtom(saveFittingsAtom);

  const [localFittings, setLocalFittings] = useState<Fittings>({});

  useEffect(() => {
    setLocalFittings(JSON.parse(JSON.stringify(globalFittings)));
  }, [globalFittings, isOpen]);

  // Effect to globally prevent scrolling when modal is open
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    const preventDefaultForScrollKeys = (e: KeyboardEvent) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'End', 'Home'].includes(e.key)) {
            e.preventDefault();
        }
    };

    if (isOpen) {
      window.addEventListener('wheel', preventDefault, { passive: false });
      window.addEventListener('keydown', preventDefaultForScrollKeys, { passive: false });
    } 

    return () => {
      window.removeEventListener('wheel', preventDefault);
      window.removeEventListener('keydown', preventDefaultForScrollKeys);
    };
  }, [isOpen]);


  if (!isOpen) return null;

  const handleInputChange = (category: string, index: number, prop: string, value: any) => {
    const newFittings = JSON.parse(JSON.stringify(localFittings));
    const item = newFittings[category][index];

    (item as any)[prop] = value;

    if (prop.includes('diameter')) {
        item.name = generateNameFromDiameters(item);
    }

    if (prop === 'diameter' && category.includes('エルボ')) {
        if (category.includes('45')) {
            item.legLength = value * 0.4;
        } else if (category.includes('90')) {
            item.legLength = value;
        }
    }

    setLocalFittings(newFittings);
  };

  const handleAddRow = (category: string) => {
    const newFittings = JSON.parse(JSON.stringify(localFittings));
    const items = newFittings[category];
    const lastItem = items.length > 0 ? items[items.length - 1] : {};
    
    const newItem = JSON.parse(JSON.stringify(lastItem));
    
    newItem.id = `${category.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
    
    newFittings[category].push(newItem);
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

  const FittingCategoryEditor = ({ category, items }: { category: string, items: FittingItem[] }) => {
    const headers = useMemo(() => {
        const headerSet = new Set<string>();
        items.forEach(item => {
            Object.keys(item).forEach(key => headerSet.add(key));
        });
        headerSet.delete('id');
        headerSet.delete('type');

        const sortedHeaders = Array.from(headerSet).sort((a, b) => {
            const order = ['name', 'visible', 'diameter', 'diameter2', 'diameter3', 'length', 'branchLength', 'legLength', 'angle', 'intersectionOffset'];
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
        return sortedHeaders;
    }, [items]);

    const headerLabelMap: Record<string, string> = {
        name: '名前',
        visible: '表示',
        diameter: '直径',
        diameter2: '直径2',
        diameter3: '直径3',
        length: '主管長',
        branchLength: '枝長',
        legLength: '脚長',
        angle: '角度',
        intersectionOffset: '交差オフセット',
    };

    const renderEditableCell = (item: FittingItem, index: number, prop: string) => {
        const value = (item as any)[prop];
        const isReadOnly = prop === 'id' || prop === 'type' || prop === 'name';

        if (prop === 'visible') {
          return (
            <td key={prop} className="p-2 text-center align-top">
              <input 
                type="checkbox" 
                checked={!!value} 
                onChange={(e) => handleInputChange(category, index, prop, e.target.checked)} 
                className="h-5 w-5 rounded mt-1"
              />
            </td>
          );
        }
        
        let inputType = typeof value === 'number' ? 'number' : 'text';

        let step = undefined;
        if (inputType === 'number') {
            if (prop.includes('diameter')) {
                step = 25;
            } else {
                step = 1;
            }
        }

        return (
            <td key={prop} className="p-2 align-top">
                <input 
                    type={inputType}
                    value={value !== undefined ? value : ''}
                    readOnly={isReadOnly}
                    step={step}
                    min={prop.includes('diameter') ? 25 : undefined}
                    onChange={(e) => {
                        const val = inputType === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                        handleInputChange(category, index, prop, val);
                    }} 
                    className={`w-full p-1 border rounded min-w-[80px] ${isReadOnly ? 'bg-gray-100' : ''}`}
                />
            </td>
        );
      }

    return (
        <div className="mb-8">
            <h3 className="text-xl font-semibold mb-3 border-b pb-2">{category}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left table-auto border-collapse">
                    <thead>
                        <tr>
                            {headers.map(header => (
                                <th key={header} className="p-2 text-sm font-semibold capitalize border-b-2">{headerLabelMap[header] || header}</th>
                            ))}
                            <th className="p-2 text-sm font-semibold border-b-2">削除</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id} className="border-t">
                                {headers.map(header => renderEditableCell(item, index, header))}
                                <td className="p-2 align-top">
                                    <button onClick={() => handleDeleteRow(category, index)} className="text-red-500 hover:text-red-700 mt-1">
                                    <Trash2 size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={() => handleAddRow(category)} className="mt-2 bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm">
                <Plus size={16} className="inline-block mr-1" />
                行を追加
            </button>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-2xl font-bold">継手管理</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2">
          {Object.entries(localFittings).map(([category, items]) => (
             <FittingCategoryEditor key={category} category={category} items={items} />
           ))}
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
