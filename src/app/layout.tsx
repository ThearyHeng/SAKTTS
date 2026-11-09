import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Kantumruy_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const kantumruyPro = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAKTTS — Khmer Text to Speech and Speech to Text, powered by AI",
  description:
    "Turn text into natural Khmer and English speech, and turn recordings into accurate, timestamped transcripts. Clone a voice, design one from a prompt, or call the API.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
  },
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('color-scheme');
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute('content', stored === 'light' || stored === 'dark' ? stored : 'light dark');
    }
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored === 'dark' || (stored !== 'light' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${kantumruyPro.variable}`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-workspace text-foreground selection:bg-primary/10 selection:text-primary min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
