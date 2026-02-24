const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');

// 初始化 OpenNext Cloudflare 开发环境支持
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.dev.coze.site'],
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
    unoptimized: true,
  },
  
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
