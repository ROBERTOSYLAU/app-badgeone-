import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import { ToastProvider } from "../lib/toast-context";
import { ConfirmProvider } from "../lib/confirm-modal";

export const metadata: Metadata = {
  title: "Badge One - Plataforma de Credenciamento",
  description: "Emissão e verificação de badges digitais",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
