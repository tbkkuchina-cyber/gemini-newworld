'use client';

import { type ReactNode, createContext, useRef, useContext } from 'react';
import { useStore, type StoreApi, UseBoundStore } from 'zustand';
import { type TemporalState } from 'zundo';
import { type DuctState, type DuctActions, createDuctStore } from './store';

// Define the type for the store instance
export type DuctStoreType = ReturnType<typeof createDuctStore>;

export const DuctStoreContext = createContext<DuctStoreType | null>(null);

export interface DuctStoreProviderProps {
  children: ReactNode;
}

export const DuctStoreProvider = ({ children }: DuctStoreProviderProps) => {
  const storeRef = useRef<DuctStoreType>();
  if (!storeRef.current) {
    storeRef.current = createDuctStore() as DuctStoreType; // Cast here
  }

  return (
    <DuctStoreContext.Provider value={storeRef.current}>
      {children}
    </DuctStoreContext.Provider>
  );
};

export function useDuctStoreContext<T>(
  selector: (state: DuctState & DuctActions) => T,
): T {
  const store = useContext(DuctStoreContext);
  if (!store) {
    throw new Error('useDuctStoreContext must be used within a DuctStoreProvider');
  }
  return useStore(store, selector);
}
