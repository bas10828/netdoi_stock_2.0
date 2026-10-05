/** @type {import('next').NextConfig} */
const nextConfig = {
  // Let phones/PCs on the office LAN use the dev server (Next blocks other origins by default)
  allowedDevOrigins: ["192.168.114.*"],
};

export default nextConfig;
