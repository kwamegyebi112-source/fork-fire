import { Sora, Bebas_Neue, Plus_Jakarta_Sans } from "next/font/google";
import PwaInstaller from "@/components/pwa-installer";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata = {
  title: "Fork N' Fire",
  description: "Owner login and daily tracker for Fork N' Fire.",
  applicationName: "Fork N' Fire",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fork N' Fire",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#fffdfb",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${bebasNeue.variable} ${plusJakartaSans.variable}`}>
        <PwaInstaller />
        {children}
      </body>
    </html>
  );
}
