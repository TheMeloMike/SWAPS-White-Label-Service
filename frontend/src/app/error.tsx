'use client';

import React from 'react';
import styled from 'styled-components';
import ErrorLayout from '@/components/layout/ErrorLayout';

const Title = styled.h1`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const Message = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const BackLink = styled.a`
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorLayout>
      <Title>Something went wrong!</Title>
      <Message>{error.message}</Message>
      <BackLink href="/">Back to Home</BackLink>
    </ErrorLayout>
  );
} 