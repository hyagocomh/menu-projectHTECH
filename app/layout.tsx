import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "@/css/bootstrap.min.css";
import "@/css/fontawesome.css";
import "@/css/animate.css";
import "@/css/main.css";
import "@/css/responsivo.css";
import "./next.css";

export const metadata: Metadata = {
  title: {
    default: "Makna's Burguer | Sabor de verdade",
    template: "%s | Makna's Burguer",
  },
  description: "Burgers artesanais, ingredientes selecionados e muito sabor direto da brasa.",
  icons: { icon: "/img/logo-maknas.png", apple: "/img/logo-maknas.png" },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
