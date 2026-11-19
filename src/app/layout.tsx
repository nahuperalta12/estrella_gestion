import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Estrella Gesti?n", description: "Gesti?n interna de Estrella Carnaval" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es-AR"><body>{children}</body></html>; }
