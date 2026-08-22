import "./globals.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import type { ReactNode } from "react";
import { ThemeInitializer } from "./theme-toggle";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Scanner Pliin", template: "%s | Scanner Pliin" },
  description: "Análise simples. Resultados confiáveis.",
  applicationName: "Scanner Pliin",
  icons: { icon: "/marca/icon.png", shortcut: "/marca/icon.png", apple: "/marca/icon.png" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Scanner Pliin",
    title: "Scanner Pliin — análise simples, resultados confiáveis",
    description: "Analise a acessibilidade do seu site com critérios WCAG 2.2 e receba um diagnóstico claro e acionável.",
    images: [{ url: "/marca/logo-stack.png", width: 1536, height: 1024, alt: "Scanner Pliin" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Scanner Pliin — análise simples, resultados confiáveis",
    description: "Diagnósticos claros de acessibilidade baseados na WCAG 2.2.",
    images: ["/marca/logo-stack.png"]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body><ThemeInitializer />{children}</body>
    </html>
  );
}
