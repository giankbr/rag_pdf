import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { ReactNode } from "react";

import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Chatbot PDF",
  description: "Frontend chat interface for RAG PDF backend"
};

const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={urbanist.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
