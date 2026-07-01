/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["playwright", "axe-core", "pa11y", "lighthouse", "pdfkit"]
};

export default nextConfig;
