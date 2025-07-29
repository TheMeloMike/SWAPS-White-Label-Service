'use client';

import React, { useState } from 'react';
import styled from 'styled-components';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchContainer = styled.div`
  width: 100%;
  position: relative;
  margin-bottom: 0.5rem;
  padding: 2px;
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary}30;
    transform: translateY(-1px);
    
    svg {
      color: ${({ theme }) => theme.colors.primary};
    }
  }
  
  &:hover:not(:focus-within) {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const Input = styled.input`
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.75rem 1rem;
  color: white;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  outline: none;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
    opacity: 0.7;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

const SearchButton = styled.button`
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all 0.2s ease;
  transform-origin: center;
  
  &:hover {
    color: ${({ theme }) => theme.colors.primary};
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  svg {
    width: 20px;
    height: 20px;
    transition: all 0.2s ease;
  }
`;

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  placeholder = 'Search...',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !disabled) {
      onSearch(query.trim());
    }
  };

  return (
    <SearchContainer>
      <form onSubmit={handleSubmit}>
        <InputWrapper>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
          <SearchButton type="submit" disabled={disabled || !query.trim()}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </SearchButton>
        </InputWrapper>
      </form>
    </SearchContainer>
  );
}; 