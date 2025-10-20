'use client';

import dynamic from 'next/dynamic';

const DuctCanvasApp = dynamic(() => import('@/components/DuctCanvasApp'), {
  ssr: false,
});

export default function Page() {
  return <DuctCanvasApp />;
}
