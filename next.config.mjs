/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium", "axe-core", "pa11y", "lighthouse", "pdfkit", "pg"],
  poweredByHeader: false,
  async headers() {
    return [{
      // The landing page is prerendered, but its HTML references build-scoped
      // assets under /_next/static. Do not let a reverse proxy keep that HTML
      // across deployments, otherwise it can point to CSS/JS that no longer
      // exists in the new container.
      source: "/",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        { key: "Pragma", value: "no-cache" }
      ]
    }, {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" }
      ]
    }, {
      source: "/assinatura",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "Pragma", value: "no-cache" }
      ]
    }, {
      source: "/api/billing/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "Pragma", value: "no-cache" }
      ]
    }];
  }
};

export default nextConfig;
