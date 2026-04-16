/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from stripping or adding trailing slashes on API routes
  skipTrailingSlashRedirect: true,

  // Proxy API calls to Django during local development
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path(.*)",
          destination: "http://localhost:8000/api/:path",
        },
      ],
    };
  },
};

export default nextConfig;
