import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Scanner Pliin",
  description: "Analisador de acessibilidade WCAG 2.2"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
