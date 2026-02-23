import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  
  // 图片配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
    // Cloudflare Pages 不支持 Next.js 图片优化
    // 部署到 Cloudflare 时取消注释：
    // unoptimized: true,
  },
  
  // Cloudflare 静态导出配置（部署时取消注释）
  // output: 'export',
  // trailingSlash: true,
};

export default nextConfig;
