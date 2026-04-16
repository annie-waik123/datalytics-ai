import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

import Providers from "@/components/Providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "DATALYTICS Auth System",
  description: "Premium OTP + JWT + Google OAuth authentication system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${fraunces.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
