import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served at https://hrforms.wct.my/WCT-Training-RQ/ behind Nginx.
  basePath: "/WCT-Training-RQ",
  // Every page here is per-user and authenticated; the classic dynamic
  // rendering model is simpler and safer than Cache Components' static shell.
  cacheComponents: false,
  poweredByHeader: false,
  // Dev only: keep the Next.js badge off the sidebar's user menu (bottom-left).
  devIndicators: { position: "bottom-right" },
  serverExternalPackages: ["@react-pdf/renderer", "exceljs", "pdf-parse"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
