'use client';

import React from 'react';
import styled from 'styled-components';
import ErrorLayout from '@/components/layout/ErrorLayout';

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Message = styled.p`
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 2rem;
`;

const BackLink = styled.a`
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  font-size: 1.1rem;
  
  &:hover {
    text-decoration: underline;
  }
`;

export default function NotFound() {
  return (
    <ErrorLayout>
      <Title>404 - Page Not Found</Title>
      <Message>The page you are looking for does not exist.</Message>
      <BackLink href="/">Return to Home</BackLink>
    </ErrorLayout>
  );
} 