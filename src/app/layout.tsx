import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import SkipLink from "@/components/ui/SkipLink";
import { ErrorReporter } from "@/components/ErrorReporter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FocusManager } from "@/components/FocusManager";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { getNavigation } from "@/lib/data";
import { SITE_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "optional",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "optional",
});

export const metadata: Metadata = {
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  metadataBase: new URL(SITE_CONFIG.url),
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: SITE_CONFIG.name,
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const navigation = await getNavigation();

  return (
    <html
      lang="de"
      className={cn(plusJakarta.variable, inter.variable)}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* Dark mode initialization — prevents flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(!localStorage.getItem("theme")&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-(--color-bg) text-(--color-text) antialiased">
        <div
          role="status"
          className="bg-(--color-secondary) text-(--color-text-inverse) text-center text-xs py-1.5 px-4"
        >
          Technisches Demo-Projekt — keine echte Nachrichtenseite.{" "}
          <a
            href="https://github.com/Datex-P/berliner-rundschau"
            className="underline hover:no-underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Quellcode auf GitHub
          </a>
        </div>
        <SkipLink />
        <ThemeProvider>
          <FocusManager />
          <AppHeader navigation={navigation} />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <AppFooter navigation={navigation} />
        </ThemeProvider>
        <ErrorReporter />
      </body>
    </html>
  );
}
