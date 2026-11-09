import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ThemeProvider from '@/components/ThemeProvider';
import PwaProvider from '@/components/PwaProvider';
import { MaintenanceBanner } from '@/components/maintenance/MaintenanceBanner';
import { ErrorBoundary } from '@/components/diagnostics/ErrorBoundary';

export const viewport: Viewport = {
  themeColor: '#4f8c4c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Zealosh LMS — Enterprise HSE Certification Learning & Examination Platform',
  description:
    'Official digital learning and examination platform for Zealosh Training & Consultants. Specializing in ASP, CSP, CRSP, CIT, and NEBOSH IDip professional certification coaching.',
  keywords: [
    'Zealosh',
    'ASP prep',
    'CSP coaching',
    'CRSP certification',
    'CIT exam',
    'NEBOSH diploma',
    'Vishnu Rajendran',
    'HSE training',
    'safety exam mock',
  ],
  manifest: '/manifest.json',
  authors: [{ name: 'Zealosh Training & Consultants' }],
  icons: {
    icon: '/logo-round.png',
    apple: '/logo-round.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo-round.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Zealosh LMS" />
      </head>
      <body className="min-h-screen flex flex-col bg-[#f4f9f3] text-slate-900 antialiased">
        <ThemeProvider>
          <PwaProvider>
            <MaintenanceBanner />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
