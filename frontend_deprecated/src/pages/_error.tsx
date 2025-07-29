'use client';

import React from 'react';
import styled from 'styled-components';
import { NextPageContext } from 'next';
import ErrorLayout from '@/components/layout/ErrorLayout';

interface ErrorProps {
  statusCode?: number;
}

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

function Error({ statusCode }: ErrorProps) {
  return (
    <ErrorLayout>
      <Title>
        {statusCode
          ? `${statusCode} - An error occurred`
          : 'An error occurred'}
      </Title>
      <Message>
        {statusCode
          ? `A ${statusCode} error occurred on server`
          : 'An error occurred on client'}
      </Message>
      <BackLink href="/">Return to Home</BackLink>
    </ErrorLayout>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error; 