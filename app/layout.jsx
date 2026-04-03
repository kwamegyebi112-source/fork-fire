import { Sora, Bebas_Neue, Plus_Jakarta_Sans } from "next/font/google";
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
  title: "Fork N' Fire | Owner Login",
  description: "Owner login and daily tracker for Fork N' Fire.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${bebasNeue.variable} ${plusJakartaSans.variable}`}>{children}</body>
    </html>
  );
}
