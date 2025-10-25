'use client';

import { FittingItem, DuctPartType } from "@/lib/types";

interface PaletteItemProps {
  item: FittingItem;
  type: string; // This is the category name
}

const PaletteItem = ({ item, type }: PaletteItemProps) => {

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.setData('text/plain', type);
  };

  const Icon = () => {
    const color = '#60a5fa'; // A neutral color for the palette
    let shape: React.ReactNode;

    switch (item.type) {
      case DuctPartType.Elbow90:
        shape = <path d="M5 45 V 5 H 45" stroke={color} strokeWidth="10" fill="none" />;
        break;
      case DuctPartType.AdjustableElbow:
        shape = <path d="M5 45 L 25 25 L 45 35" stroke={color} strokeWidth="10" fill="none" />;
        break;
      case DuctPartType.Tee:
      case DuctPartType.TeeReducer:
        shape = <path d="M5 25 H 45 M 25 25 V 5" stroke={color} strokeWidth="10" fill="none" />;
        break;
      case DuctPartType.YBranch:
      case DuctPartType.YBranchReducer:
        shape = <path d="M5 25 H 45 M 25 25 L 40 10" stroke={color} strokeWidth="8" fill="none" />;
        break;
      case DuctPartType.Damper:
        shape = <><rect x="5" y="20" width="40" height="10" fill={color} /><line x1="10" y1="25" x2="40" y2="25" stroke="#1e293b" strokeWidth="2" /></>;
        break;
      case DuctPartType.Reducer:
        shape = <path d="M5 15 L 45 20 L 45 30 L 5 35 Z" fill={color} />;
        break;
      case DuctPartType.Cap:
        shape = <rect x="5" y="15" width="10" height="20" fill={color} />;
        break;
      case DuctPartType.Straight:
      default:
        shape = <rect x="5" y="20" width="40" height="10" fill={color} />;
        break;
    }

    return (
      <svg viewBox="0 0 50 50" className="w-12 h-12 mx-auto">
        {shape}
      </svg>
    );
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="bg-white p-2 border rounded-md shadow-sm cursor-pointer text-center hover:shadow-lg transition-shadow"
      title={item.name}
    >
      <Icon />
      <p className="text-sm mt-1 font-medium truncate">{item.name}</p>
    </div>
  );
};

export default PaletteItem;
