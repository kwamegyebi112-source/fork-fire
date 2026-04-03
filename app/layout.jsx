import { Sora, Bebas_Neue } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
});

export const metadata = {
  title: "Fork N' Fire | Owner Login",
  description: "Owner login and daily tracker for Fork N' Fire.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${bebasNeue.variable}`}>{children}</body>
    </html>
  );
}
