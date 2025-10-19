'use client';

import { FittingItem } from "@/lib/types";

interface PaletteItemProps {
  item: FittingItem;
  type: string;
}

const PaletteItem = ({ item, type }: PaletteItemProps) => {

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.setData('text/plain', type);
  };

  // A simple placeholder icon for now
  const Icon = () => (
    <svg viewBox="0 0 50 50" className="w-12 h-12 mx-auto">
      <rect x="5" y="20" width="40" height="10" fill="#9ca3af" />
    </svg>
  );

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
