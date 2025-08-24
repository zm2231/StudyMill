import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { theme } from "@/lib/theme";
import { AuthProvider } from "@/hooks/useAuth";
import { TimerProvider } from "@/contexts/TimerContext";
import { PersistentAudioProvider } from "@/contexts/PersistentAudioContext";
import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyMill - AI-Powered Academic Study Platform",
  description: "Transform your study workflow with AI-powered document processing, flashcards, and study guides.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MantineProvider theme={theme}>
          <ModalsProvider>
            <TimerProvider>
              <PersistentAudioProvider>
                <AuthProvider>
                  <Notifications />
                  {children}
                </AuthProvider>
              </PersistentAudioProvider>
            </TimerProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
