'use client';

import DuctCanvasApp from "@/components/DuctCanvasApp";
import { ClientOnlyProvider } from "@/lib/ClientOnlyProvider";

export default function Page() {
  return (
    <ClientOnlyProvider>
      <DuctCanvasApp />
    </ClientOnlyProvider>
  );
}

