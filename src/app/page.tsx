'use client';

import dynamic from 'next/dynamic';

// 动态导入主页组件，禁用 SSR（因为使用了 localStorage）
const VocabAppContent = dynamic(() => import('./VocabAppContent').then(mod => ({ default: mod.VocabAppContent })), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    </div>
  )
});

export default function Page() {
  return <VocabAppContent />;
}
