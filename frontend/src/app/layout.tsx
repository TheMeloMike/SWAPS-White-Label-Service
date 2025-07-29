import { Providers } from '@/providers/Providers';
import { Metadata } from 'next';
import { Roboto_Mono, Michroma } from 'next/font/google';
import { ClientLayout } from '@/components/ClientLayout';
import dynamic from 'next/dynamic';

// Dynamically import AnimatedBackground to avoid SSR issues
const AnimatedBackground = dynamic(
  () => import('@/components/shared/AnimatedBackground'),
  { ssr: false }
);

const robotoMono = Roboto_Mono({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-roboto-mono'
});

const michroma = Michroma({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-michroma'
});

export const metadata: Metadata = {
  title: 'SWAPS - NFT Trading Platform',
  description: 'Trade NFTs efficiently with SWAPS',
  icons: {
    icon: '/favicon.svg',
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${robotoMono.variable} ${michroma.variable}`}>
        <Providers>
          <AnimatedBackground />
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
} 