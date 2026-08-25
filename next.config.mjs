/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium", "axe-core", "pa11y", "lighthouse", "pdfkit", "pg"],
  poweredByHeader: false,
  async headers() {
    return [{
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
