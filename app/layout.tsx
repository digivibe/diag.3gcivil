import type { Metadata, Viewport } from "next";
import { Antonio, Geist, Geist_Mono } from "next/font/google";
import "lenis/dist/lenis.css";
import { themeBootstrapScript } from "@/lib/theme";
import "./globals.css";

const display = Antonio({
  variable: "--font-antonio",
  subsets: ["latin"],
  weight: ["300", "500", "700"],
});

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://diagnostic.groupe3g.fr"),
  title: "Diagnostic structure Paris & Île-de-France – Rapport sous 72h | 3G CIVIL",
  description:
    "Bureau d'études structure expert en diagnostics, fissures et inspections techniques. Intervention rapide, rapport sous 72h. Paris & Île-de-France.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    title: "Diagnostic structure Paris & Île-de-France – Rapport sous 72h | 3G CIVIL",
    description:
      "Bureau d'études structure expert en diagnostics, fissures et inspections techniques. Intervention rapide, rapport sous 72h. Paris & Île-de-France.",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme est posé avant l'hydratation par le script d'amorçage, d'où suppressHydrationWarning.
    <html lang="fr" className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <body>
        {/* Premier nœud du body : s'exécute pendant l'analyse du HTML, avant le premier rendu (pas de flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
