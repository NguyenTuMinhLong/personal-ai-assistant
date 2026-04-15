/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },
};

module.exports = nextConfig;
