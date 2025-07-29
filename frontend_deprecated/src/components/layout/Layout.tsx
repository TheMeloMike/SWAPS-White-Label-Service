'use client';

import React, { ReactNode } from 'react';
import styled from 'styled-components';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface LayoutProps {
  children: ReactNode;
}

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.colors.background};
`;

const Main = styled.main`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
`;

const Header = styled.header`
  padding: ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.textSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.textSecondary};
`;

const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
`;

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Container>
      <Header>
        <HeaderContent>
          <Title>NFT Swaps</Title>
          <WalletMultiButton />
        </HeaderContent>
      </Header>
      <Main>{children}</Main>
    </Container>
  );
}; 