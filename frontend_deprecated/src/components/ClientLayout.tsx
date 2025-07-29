'use client';

import StyledComponentsRegistry from '@/lib/registry';
import { Providers } from '@/providers/Providers';
import CornerLogo from './CornerLogo';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <Providers>
        {children}
        <CornerLogo />
      </Providers>
    </StyledComponentsRegistry>
  );
} 