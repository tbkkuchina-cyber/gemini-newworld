'use client';
import { Provider } from 'jotai';
import { type ReactNode } from 'react';

// This provider component will wrap the application in layout.tsx
// It ensures that all Jotai atoms have a fresh state for each request on the server,
// and a single shared state on the client.
export const JotaiProvider = ({ children }: { children: ReactNode }) => {
  return <Provider>{children}</Provider>;
};