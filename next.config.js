const withNextIntl = require('next-intl/plugin')();
const withHttps = require('next-https');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  experimental: {
    webpackBuildWorker: true,
  },
};

module.exports = withNextIntl(withHttps({
  ...nextConfig,
  https: {
    key: './tool.myweb.com-key.pem',
    cert: './tool.myweb.com.pem',
  },
})); 