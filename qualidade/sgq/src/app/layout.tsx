import type { Metadata } from "next";
import { Monda } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const monda = Monda({
  variable: "--font-monda",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('sgq-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export const metadata: Metadata = {
  title: "SGQ — Só Aço Industrial",
  description: "Sistema de Gestão da Qualidade — Só Aço Industrial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${monda.variable} ${monda.className} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
