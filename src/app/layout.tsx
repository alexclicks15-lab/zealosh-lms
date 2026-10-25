import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

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
  authors: [{ name: 'Zealosh Training & Consultants' }],
  icons: {
    icon: '/logo-round.png',
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
      </head>
      <body className="min-h-screen flex flex-col bg-[#f7f9fc] text-[#252c41] antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
