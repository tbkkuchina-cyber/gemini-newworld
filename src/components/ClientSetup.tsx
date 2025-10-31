'use client';

import { useEffect } from 'react';

/**
 * サービスワーカーの登録など、クライアントサイドでのみ実行する
 * 初期化処理を担当するコンポーネント。
 */
export default function ClientSetup() {
  // --- Add useEffect for Service Worker Registration ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(error => {
            console.log('ServiceWorker registration failed: ', error);
          });
      });
    }
  }, []);
  // ---------------------------------------------------

  return null; // このコンポーネントは何もレンダリングしません
}
