import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Badge One App",
  description: "Administração e emissão de credenciais Badge One",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif", background: "#070f2c", color: "#f5f7ff" }}>
        {children}
      </body>
    </html>
  );
}
