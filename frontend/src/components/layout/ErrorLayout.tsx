'use client';

import React from 'react';
import styled from 'styled-components';

interface ErrorLayoutProps {
  children: React.ReactNode;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.background};
`;

export default function ErrorLayout({ children }: ErrorLayoutProps) {
  return <Container>{children}</Container>;
} 