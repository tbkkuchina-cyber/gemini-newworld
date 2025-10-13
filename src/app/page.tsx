// src/app/page.tsx

import CanvasArea from "@/components/CanvasArea";
import Palette from "@/components/Palette";
import Toolbar from "@/components/Toolbar";

export default function Home() {
  return (
    <div className="w-screen h-screen bg-gray-100 text-gray-800 flex flex-col md:flex-row overflow-hidden">
      {/* メインエリア：モバイル(縦)では2番目、PC(横)では1番目に表示 */}
      <main className="flex-1 flex flex-col order-2 md:order-1 min-w-0">
        <Toolbar />
        <div className="flex-1 relative">
          <CanvasArea />
        </div>
      </main>
      
      {/* パレットエリア：コンポーネント側で順序を制御 */}
      <Palette />
    </div>
  );
}