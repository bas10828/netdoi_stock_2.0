import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import Providers from "./providers";
import "./globals.css";

const sans = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: { default: "netdoi stock", template: "%s · netdoi stock" },
  description: "ระบบเก็บข้อมูลอุปกรณ์ที่ติดตั้งและการเคลม",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Sets the light/dark class before paint so there is no flash */}
        <InitColorSchemeScript attribute="class" defaultMode="system" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
