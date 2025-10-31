'use client';

import { useEffect } from 'react';

const ServiceWorkerRegister = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js') // publicディレクトリのsw.jsを登録
          .then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch((error) => {
            console.log('ServiceWorker registration failed: ', error);
          });
      });
    }
  }, []);

  return null; // このコンポーネントはUIをレンダリングしない
};

export default ServiceWorkerRegister;
