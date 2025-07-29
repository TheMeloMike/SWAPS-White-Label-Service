import { Providers } from '@/providers/Providers';
import { Metadata } from 'next';
import { Roboto_Mono, Michroma } from 'next/font/google';
import { ClientLayout } from '@/components/ClientLayout';

const robotoMono = Roboto_Mono({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap'
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
      <body className={`${robotoMono.className} ${michroma.variable}`}>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
} 