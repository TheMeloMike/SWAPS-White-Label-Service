'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { PublicKey } from '@solana/web3.js';

interface SearchBarProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchContainer = styled.div`
  display: flex;
  gap: 1rem;
  width: 100%;
  max-width: 600px;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  background: #2a2a2a;
  color: white;

  &:focus {
    outline: none;
    border-color: #512da8;
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  background: #512da8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;

  &:disabled {
    background: #666;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: #673ab7;
  }
`;

export function SearchBar({ onSearch, placeholder, disabled }: SearchBarProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  };

  return (
    <SearchContainer 
      as="form" 
      onSubmit={handleSubmit}
      role="search"
      aria-label="NFT Search"
    >
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "Search..."}
        disabled={disabled}
        aria-label="NFT mint address"
        required
      />
      <Button 
        type="submit" 
        disabled={disabled || !value.trim()}
        aria-busy={disabled}
      >
        {disabled ? 'Searching...' : 'Search'}
      </Button>
    </SearchContainer>
  );
}

const SearchInput = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e5e5e5;
  border-radius: 8px;
  font-size: 16px;
  outline: none;

  &:focus {
    border-color: #0066ff;
  }

  &:disabled {
    background-color: #f5f5f5;
  }
`;

const SearchButton = styled.button`
  padding: 12px 24px;
  background-color: #0066ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background-color: #0052cc;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ErrorText = styled.p`
  color: #ef4444;
  margin-top: 0.5rem;
  font-size: 14px;
`; 