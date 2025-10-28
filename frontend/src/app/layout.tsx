import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hall Booking System",
  description: "Enterprise-grade hall booking platform with flexible payment options",
  keywords: ["hall booking", "venue booking", "event management", "payment system"],
  authors: [{ name: "Faizan Khan" }],
  creator: "LoneWolf36",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="relative flex min-h-screen flex-col">
              <Navigation />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster position="top-center" richColors closeButton />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
