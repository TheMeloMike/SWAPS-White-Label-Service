'use client';

import { usePathname } from 'next/navigation';
import StyledComponentsRegistry from '@/lib/registry';
import { Providers } from '@/providers/Providers';
import CornerLogo from './CornerLogo';
import ParticleBackground from './common/ParticleBackground';
import MainLayout from './layout/MainLayout';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <Providers>
        <ParticleBackground 
          particleCount={40}
          speed={0.2}
          color="rgba(123, 97, 255, 0.15)"
          interactive={true}
          density={15000}
          size={2}
        />
        
        <MainLayout>{children}</MainLayout>
        
        <CornerLogo />
      </Providers>
    </StyledComponentsRegistry>
  );
} 