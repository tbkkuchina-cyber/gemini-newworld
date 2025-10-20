'use client';

import { useState, useEffect, type ReactNode } from 'react';

/**
 * This component ensures that its children are only rendered on the client side.
 * It prevents hydration mismatches by returning null on the server and during the initial client render.
 */
export function ClientOnlyProvider({ children }: { children: ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
