import { useState, FormEvent } from 'react';
import { isValidSolanaAddress } from '@/lib/nft/validation';
import styled from 'styled-components';

interface SearchInputProps {
  onSearch: (address: string) => Promise<void>;
  disabled?: boolean;
}

export const SearchInput = ({ onSearch, disabled }: SearchInputProps) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!value.trim()) {
      setError('Please enter an NFT address');
      return;
    }

    if (!isValidSolanaAddress(value.trim())) {
      setError('Please enter a valid Solana address');
      return;
    }

    try {
      setIsSearching(true);
      await onSearch(value.trim());
    } catch (err) {
      setError('Error searching for NFT');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <SearchContainer>
      <SearchForm onSubmit={handleSubmit}>
        <SearchBox
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste NFT token address..."
          disabled={disabled || isSearching}
          hasError={!!error}
        />
        <SearchButton 
          type="submit" 
          disabled={disabled || isSearching || !value.trim()}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </SearchButton>
      </SearchForm>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </SearchContainer>
  );
};

const SearchContainer = styled.div`
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
`;

const SearchForm = styled.form`
  display: flex;
  gap: 8px;
`;

const SearchBox = styled.input<{ hasError?: boolean }>`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid ${props => props.hasError ? 'red' : '#ccc'};
  border-radius: 8px;
  font-size: 16px;
  outline: none;

  &:focus {
    border-color: ${props => props.hasError ? 'red' : '#0066ff'};
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
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
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: #0052cc;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.p`
  color: red;
  font-size: 14px;
  margin-top: 8px;
  text-align: left;
`; 