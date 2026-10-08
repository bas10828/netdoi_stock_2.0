/** @type {import('next').NextConfig} */

const securityHeaders = [
  // No other site may show these pages in a frame (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera stays allowed for the label scanner
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  // Production only: on localhost HSTS would force HTTPS on every local port.
  // No includeSubDomains: the parent domain hosts other services.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig = {
  // Self-contained server in .next/standalone for the Docker image (see Dockerfile)
  output: "standalone",
  // Let phones/PCs on the office LAN use the dev server (Next blocks other origins by default)
  allowedDevOrigins: ["192.168.114.*"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
