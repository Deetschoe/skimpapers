/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
