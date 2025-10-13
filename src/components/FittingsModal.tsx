'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { DuctPartOptions, FittingsData, Fitting } from '@/lib/types';

const propertyNameMap: Partial<Record<keyof DuctPartOptions, string>> = {
    diameter: '直径',
    diameter2: '直径2',
    diameter3: '直径3',
    length: '主管長',
    legLength: '脚長',
    angle: '角度',
    branchLength: '枝管長',
    intersectionOffset: '交差オフセット',
};

const generateFittingName = (fitting: Fitting): string => {
    const { type, defaultOptions } = fitting;
    const { diameter, diameter2, diameter3, angle } = defaultOptions;

    switch (type) {
        case 'Elbow90':
            return `D${diameter}`;
        case 'AdjustableElbow':
            const bendAngle = (angle && angle > 90) ? 180 - angle : angle;
            return `D${diameter} ${bendAngle}°`;
        case 'TeeReducer':
        case 'YBranchReducer':
            return `D${diameter}-${diameter2}-${diameter3}`;
        case 'Reducer':
            return `D${diameter}-${diameter2}`;
        case 'Damper':
            return `VD${diameter}`;
        default:
            return `D${diameter}`;
    }
};

const FittingsModal = () => {
    const {
        isFittingsModalOpen,
        toggleFittingsModal,
        fittings: storeFittings,
        saveFittings,
    } = useAppStore();

    const [editingFittings, setEditingFittings] = useState<FittingsData | null>(null);

    useEffect(() => {
        if (isFittingsModalOpen) {
            setEditingFittings(JSON.parse(JSON.stringify(storeFittings)));
        }
    }, [isFittingsModalOpen, storeFittings]);

    if (!isFittingsModalOpen || !editingFittings) {
        return null;
    }

    const handleSave = () => {
        saveFittings(editingFittings);
        toggleFittingsModal();
    };

    const handlePropertyChange = (fittingId: string, property: keyof DuctPartOptions, value: number) => {
        setEditingFittings(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            for (const category in newState) {
                const fitting = newState[category].find((f: Fitting) => f.id === fittingId);
                if (fitting && property in fitting.defaultOptions) {
                    fitting.defaultOptions[property] = value;

                    if ((fitting.type === 'Elbow90' || fitting.type === 'AdjustableElbow') && property === 'diameter') {
                        if (fitting.type === 'AdjustableElbow' && fitting.defaultOptions.angle === 45) {
                            fitting.defaultOptions.legLength = value * 0.4;
                        } else {
                            fitting.defaultOptions.legLength = value;
                        }
                    }
                    
                    fitting.name = generateFittingName(fitting);
                    break;
                }
            }
            return newState;
        });
    };

    const handleAddFitting = (category: string) => {
        setEditingFittings(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            const categoryFittings = newState[category];
            if (!categoryFittings || categoryFittings.length === 0) return newState;

            const template = categoryFittings[0];
            const newFitting: Fitting = {
                ...template,
                id: `fitting-${Date.now()}-${Math.random()}`,
                visible: true,
            };
            newFitting.name = generateFittingName(newFitting);
            newState[category].push(newFitting);
            return newState;
        });
    };

    const handleDeleteFitting = (fittingId: string) => {
        setEditingFittings(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            for (const category in newState) {
                const index = newState[category].findIndex((f: Fitting) => f.id === fittingId);
                if (index !== -1) {
                    newState[category].splice(index, 1);
                    return newState;
                }
            }
            return newState;
        });
    };

    const handleVisibilityChange = (fittingId: string, visible: boolean) => {
        setEditingFittings(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            for (const category in newState) {
                const fitting = newState[category].find((f: Fitting) => f.id === fittingId);
                if (fitting) {
                    fitting.visible = visible;
                    return newState;
                }
            }
            return newState;
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center border-b p-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold">継手管理</h2>
                    <button onClick={toggleFittingsModal} className="p-2 rounded-full hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    <div className="space-y-6">
                        {Object.entries(editingFittings).map(([category, items]) => (
                            <div key={category}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xl font-semibold pb-1">{category}</h3>
                                    <button onClick={() => handleAddFitting(category)} className="text-sm bg-indigo-500 text-white py-1 px-3 rounded-md hover:bg-indigo-600">＋ 追加</button>
                                </div>
                                <div className="space-y-2 border rounded-lg p-3 bg-gray-50/30">
                                    <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-500 px-2">
                                        <div className="col-span-2">名前</div>
                                        <div className="col-span-7 grid grid-cols-4 gap-2">
                                            {Object.keys(items[0]?.defaultOptions || {}).map(key => (
                                                propertyNameMap[key as keyof DuctPartOptions] && <div key={key}>{propertyNameMap[key as keyof DuctPartOptions]}</div>
                                            ))}
                                        </div>
                                        <div className="col-span-3 text-center">アクション</div>
                                    </div>
                                    {items.map(fitting => (
                                        <div key={fitting.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md hover:bg-white border">
                                            <div className="col-span-2">
                                                <input type="text" value={fitting.name} readOnly className="w-full bg-gray-100 p-1 border rounded-md text-sm cursor-default" />
                                            </div>
                                            <div className="col-span-7 grid grid-cols-4 gap-2">
                                                {Object.entries(fitting.defaultOptions).map(([key, value]) => {
                                                    const property = key as keyof DuctPartOptions;
                                                    if (propertyNameMap[property]) {
                                                        return (
                                                            <input 
                                                                key={property}
                                                                type="number"
                                                                value={value}
                                                                step={property.includes('diameter') ? 25 : 1}
                                                                onChange={(e) => handlePropertyChange(fitting.id, property, parseFloat(e.target.value) || 0)}
                                                                className="w-full p-1 border rounded-md text-sm"
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                            <div className="col-span-3 flex items-center justify-center gap-2">
                                                <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-100">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={fitting.visible}
                                                        onChange={(e) => handleVisibilityChange(fitting.id, e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-xs">表示</span>
                                                </label>
                                                <button onClick={() => handleDeleteFitting(fitting.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-md" title="削除">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                 <div className="border-t p-4 flex justify-end flex-shrink-0 bg-gray-50/70 space-x-2">
                    <button onClick={toggleFittingsModal} className="bg-gray-500 text-white font-semibold py-2 px-6 rounded-md hover:bg-gray-600 transition-colors">
                        キャンセル
                    </button>
                    <button onClick={handleSave} className="bg-indigo-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-indigo-700 transition-colors">
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FittingsModal;
