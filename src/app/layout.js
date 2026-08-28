import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://cruiser-web.vercel.app"),
  title: {
    default: "Cruiser — Find car meets near you",
    template: "%s | Cruiser",
  },
  description: "Discover and host car meets, cruises, and shows near you. Join car clubs, build your garage, and connect with the community.",
  openGraph: {
    title: "Cruiser — Find car meets near you",
    description: "Discover and host car meets, cruises, and shows near you.",
    url: "https://cruiser-web.vercel.app",
    siteName: "Cruiser",
    images: ["/hero.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cruiser — Find car meets near you",
    description: "Discover and host car meets, cruises, and shows near you.",
    images: ["/hero.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
