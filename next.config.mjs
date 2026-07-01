/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium", "axe-core", "pa11y", "lighthouse", "pdfkit"]
};

export default nextConfig;
