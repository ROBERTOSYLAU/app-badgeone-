import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Badge One App",
  description: "Administração e emissão de credenciais Badge One",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
