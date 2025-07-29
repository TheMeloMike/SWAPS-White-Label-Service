'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNFTTrading } from '@/hooks/useNFTTrading';
import NFTCard from '@/components/NFTCard';
import { NFTMetadata } from '@/types/nft';
import EnhancedRippleButton from '@/components/common/EnhancedRippleButton';
import { useSortNFTs } from '@/hooks/useSortNFTs';
import LoadingIndicator from '@/components/common/LoadingIndicator';
import ContextualEmptyState from '@/components/common/ContextualEmptyState';
import ErrorMessage from '@/components/common/ErrorMessage';

import { IoAppsSharp, IoListOutline, IoFilterOutline, IoClose } from 'react-icons/io5';
import { FaSortAmountDown } from 'react-icons/fa';
import { MdCollectionsBookmark } from 'react-icons/md';
import Image from 'next/image';
import NFTTradeModal from '@/components/NFTTradeModal';
import { NFTService } from '@/services/nft';
import { CollectionService } from '@/services/collection';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { CollectionSearchResult, CollectionWant } from '@/types/trade';

// Simple SearchInput component for inventory filtering
interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
}

const SearchInputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const SearchInputField = styled.input`
  width: 100%;
  background: rgba(38, 41, 50, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  padding: 0.5rem 2.5rem 0.5rem 1rem;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.875rem;
  transition: all 0.2s ease;
  outline: none;
  
  &:focus {
    border-color: rgba(103, 69, 255, 0.5);
    background: rgba(38, 41, 50, 0.9);
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1rem;
  pointer-events: none;
`;

const SimpleSearchInput: React.FC<SearchInputProps> = ({ onSearch, placeholder = "Search..." }) => {
  const [value, setValue] = React.useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onSearch(newValue);
  };

  return (
    <SearchInputWrapper>
      <SearchInputField
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
      />
      <SearchIcon>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </SearchIcon>
    </SearchInputWrapper>
  );
};

// Modern, sleek page container
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 80vh;
  position: relative;
`;

// Header section with title and stats
const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
`;

const PageTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TitleCount = styled.span`
  background: rgba(103, 69, 255, 0.2);
  color: ${({ theme }) => theme.colors.primary};
  padding: 0.1rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.9rem;
  font-weight: 500;
`;

// Main controls container
const ControlsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(24, 26, 32, 0.7);
  border-radius: 0.875rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  
  @media (max-width: 900px) {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }
`;

// Search section
const SearchSection = styled.div`
  flex: 1;
  max-width: 380px;
  
  @media (max-width: 900px) {
    max-width: 100%;
    width: 100%;
  }
`;

// View toggle and filter section
const ViewOptionsSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  @media (max-width: 900px) {
    width: 100%;
    justify-content: space-between;
  }
`;

// Button group for view toggle
const ViewToggleGroup = styled.div`
  display: flex;
  background: rgba(38, 41, 50, 0.7);
  border-radius: 0.5rem;
  padding: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
`;

// View toggle button
const ViewToggleButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.2)' : 'transparent'};
  border: none;
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  padding: 0.5rem;
  border-radius: 0.35rem;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
    background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
  }
  
  svg {
    font-size: 1.2rem;
  }
`;

// Filter dropdown button
const FilterButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.2)' : 'rgba(38, 41, 50, 0.7)'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary + '50' : 'rgba(255, 255, 255, 0.08)'};
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  svg {
    font-size: 1rem;
  }
`;

// Filter panel for collections
const FilterPanel = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 320px;
  background: rgba(24, 26, 32, 0.95);
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  padding: 1rem;
  z-index: 100;
  transform-origin: top right;
  transition: all 0.2s ease;
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  transform: ${({ $visible }) => $visible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.97)'};
  visibility: ${({ $visible }) => $visible ? 'visible' : 'hidden'};
  
  @media (max-width: 768px) {
    width: 100%;
    right: auto;
    left: 0;
    transform-origin: top center;
  }
`;

const FilterPanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const FilterPanelTitle = styled.h3`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
    background: rgba(255, 255, 255, 0.05);
  }
  
  svg {
    font-size: 1.1rem;
  }
`;

const CollectionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 0.25rem;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
`;

const CollectionItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.1)' : 'transparent'};
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary + '50' : 'transparent'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
  font-size: 0.875rem;
  width: 100%;
  
  &:hover {
    background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
    color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textPrimary};
  }
`;

const CollectionCount = styled.span`
  background: rgba(255, 255, 255, 0.1);
  color: ${({ theme }) => theme.colors.textSecondary};
  border-radius: 1rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
`;

// Sort dropdown section
const SortDropdown = styled.div`
  position: relative;
`;

const SortButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.2)' : 'rgba(38, 41, 50, 0.7)'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary + '50' : 'rgba(255, 255, 255, 0.08)'};
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  svg {
    font-size: 1rem;
  }
`;

const SortPanel = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 200px;
  background: rgba(24, 26, 32, 0.95);
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
  padding: 0.5rem;
  z-index: 100;
  transform-origin: top right;
  transition: all 0.2s ease;
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  transform: ${({ $visible }) => $visible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.97)'};
  visibility: ${({ $visible }) => $visible ? 'visible' : 'hidden'};
`;

const SortOption = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.1)' : 'transparent'};
  border: none;
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
  font-size: 0.875rem;
  
  &:hover {
    background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
    color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textPrimary};
  }
`;

// Active filters display
const ActiveFiltersBar = styled.div<{ $visible: boolean }>`
  display: ${({ $visible }) => $visible ? 'flex' : 'none'};
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ActiveFilter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(103, 69, 255, 0.15);
  border: 1px solid rgba(103, 69, 255, 0.3);
  border-radius: 0.5rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.primary};
`;

const RemoveFilterButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  padding: 0.1rem;
  transition: all 0.15s ease;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
    transform: scale(1.1);
  }
  
  svg {
    font-size: 0.9rem;
  }
`;

const ClearFiltersButton = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: ${({ theme }) => theme.colors.textSecondary};
  border-radius: 0.5rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  transition: all 0.15s ease;
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

// NFT Grids based on view type
const NFTGridContainer = styled.div`
  margin-bottom: 2rem;
`;

const NFTGrid = styled.div<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: ${({ $compact }) => 
    $compact 
      ? 'repeat(auto-fill, minmax(140px, 1fr))' 
      : 'repeat(auto-fill, minmax(240px, 1fr))'};
  gap: ${({ $compact }) => $compact ? '0.6rem' : '1.25rem'};
  width: 100%;
  will-change: contents;
  
  @media (max-width: 500px) {
    grid-template-columns: ${({ $compact }) => 
      $compact 
        ? 'repeat(auto-fill, minmax(110px, 1fr))' 
        : 'repeat(auto-fill, minmax(150px, 1fr))'};
    gap: ${({ $compact }) => $compact ? '0.5rem' : '0.75rem'};
  }
`;

const NFTListView = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`;

const ListViewItem = styled.div`
  display: flex;
  align-items: center;
  background: rgba(24, 26, 32, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.625rem;
  transition: all 0.15s ease;
  height: 3.5rem;
  cursor: pointer;
  
  &:hover {
    background: rgba(38, 41, 50, 0.6);
    border-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    height: auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
  }
`;

const ListViewImageContainer = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(13, 13, 16, 0.5);
  margin-right: 1rem;
  flex-shrink: 0;
  
  img {
    object-fit: cover;
  }
  
  @media (max-width: 768px) {
    width: 3rem;
    height: 3rem;
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
`;

const ListViewDetails = styled.div`
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  @media (max-width: 768px) {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
`;

const NFTInfo = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
`;

const NFTName = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NFTCollection = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NFTPrice = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }
`;

const PriceLabel = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const MiniSpinner = styled.div`
  width: 10px;
  height: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-top: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const PriceValue = styled.span`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

// Status containers
const CenteredStatusContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  width: 100%;
  padding: 2rem;
  box-sizing: border-box;
`;

// Use the simple search input directly (no need to style it since it's already styled)
const StyledSearchInput = SimpleSearchInput;

// Pagination controls
const PaginationControls = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  gap: 0.5rem;
`;

const PageButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.2)' : 'rgba(38, 41, 50, 0.7)'};
  color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.primary + '50' : 'rgba(255, 255, 255, 0.08)'};
  border-radius: 0.5rem;
  transition: all 0.15s ease;
  cursor: pointer;
  font-size: 0.875rem;
  
  &:hover:not(:disabled) {
    background: ${({ $active }) => $active ? 'rgba(103, 69, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const PAGE_SIZE = 12;

// Add these new styled components for the container
const SectionContainer = styled.div`
  background: rgba(24, 26, 32, 0.7);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-bottom: 2rem;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SectionContent = styled.div`
  padding: 1.5rem;
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const StatsLabel = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: rgba(255, 255, 255, 0.05);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
`;

// Memoized NFT item component to prevent unnecessary re-renders
const MemoizedNFTCard = React.memo(NFTCard);

// Collection wants section styles
const CollectionWantsSection = styled.div`
  background: rgba(24, 26, 32, 0.7);
  border-radius: 0.875rem;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
`;

const CollectionWantsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const CollectionWantsTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  svg {
    color: ${({ theme }) => theme.colors.primary};
    font-size: 1.2rem;
  }
`;

const CollectionWantsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
`;

const CollectionWantCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(103, 69, 255, 0.3);
    transform: translateY(-2px);
  }
`;

const CollectionWantImage = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 0.5rem;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
`;

const CollectionWantInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const CollectionWantName = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CollectionWantStats = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 0.25rem;
`;

const EmptyCollectionWants = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const AddCollectionButton = styled.button`
  background: rgba(103, 69, 255, 0.1);
  border: 1px solid rgba(103, 69, 255, 0.3);
  color: ${({ theme }) => theme.colors.primary};
  border-radius: 0.5rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: rgba(103, 69, 255, 0.2);
    transform: translateY(-1px);
  }
`;

export default function InventoryPage() {
  const { userNFTs, isIndexing, error } = useNFTTrading();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('compact');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('collection');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingFloorPrices, setIsLoadingFloorPrices] = useState(false);
  const [collectionWants, setCollectionWants] = useState<CollectionWant[]>([]);
  const [isLoadingWants, setIsLoadingWants] = useState(false);
  
  // Fetch collection wants
  useEffect(() => {
    const fetchCollectionWants = async () => {
      if (connected && publicKey) {
        try {
          setIsLoadingWants(true);
          const collectionService = CollectionService.getInstance();
          const wants = await collectionService.getWalletCollectionWants(publicKey.toString());
          setCollectionWants(wants);
        } catch (error) {
          console.error('Error fetching collection wants:', error);
        } finally {
          setIsLoadingWants(false);
        }
      }
    };
    
    fetchCollectionWants();
  }, [connected, publicKey]);
  
  // Fetch floor prices when NFTs load
  useEffect(() => {
    const fetchFloorPrices = async () => {
      if (userNFTs && userNFTs.length > 0 && !isIndexing) {
        try {
          setIsLoadingFloorPrices(true);
          const nftService = NFTService.getInstance();
          await nftService.getFloorPrices(userNFTs);
          setIsLoadingFloorPrices(false);
        } catch (error) {
          console.error('Error fetching floor prices:', error);
          setIsLoadingFloorPrices(false);
        }
      }
    };
    
    fetchFloorPrices();
  }, [userNFTs, isIndexing]);
  
  // Enhanced collection handling with proper naming
  const collectionInfo = userNFTs.reduce((acc, nft) => {
    let collectionName = 'Unknown Collection';
    
    // Determine collection name from the NFT metadata
    if (typeof nft.collection === 'string') {
      // If it's a hash-like string (longer than 15 chars), try to use a readable name
      if (nft.collection.length > 15 && !nft.collection.includes(' ')) {
        // Use the NFT name as a fallback for the collection (truncated)
        collectionName = nft.name ? nft.name.split('#')[0].trim() : 'Collection';
      } else {
        collectionName = nft.collection;
      }
    } else if (nft.collection?.name) {
      collectionName = nft.collection.name;
    }
    
    // Ensure it's a nice readable name
    collectionName = collectionName.replace(/^\d+/g, '').trim() || 'Unknown Collection';
    
    // Add the collection to our mapping
    if (!acc[collectionName]) {
      acc[collectionName] = {
        count: 1,
        nfts: [nft]
      };
    } else {
      acc[collectionName].count++;
      acc[collectionName].nfts.push(nft);
    }
    
    return acc;
  }, {} as Record<string, { count: number, nfts: NFTMetadata[] }>);
  
  // Get collection names sorted by count
  const collections = Object.keys(collectionInfo).sort((a, b) => 
    collectionInfo[b].count - collectionInfo[a].count
  );
  
  // Apply sorting
  const sortedNFTs = useSortNFTs(userNFTs, sortOption);
  
  // Apply filtering and search
  const filteredNFTs = sortedNFTs.filter((nft: NFTMetadata) => {
    // Get collection name with the same logic as above for consistency
    let collectionName = 'Unknown Collection';
    
    if (typeof nft.collection === 'string') {
      if (nft.collection.length > 15 && !nft.collection.includes(' ')) {
        collectionName = nft.name ? nft.name.split('#')[0].trim() : 'Collection';
      } else {
        collectionName = nft.collection;
      }
    } else if (nft.collection?.name) {
      collectionName = nft.collection.name;
    }
    
    collectionName = collectionName.replace(/^\d+/g, '').trim() || 'Unknown Collection';
    
    const matchesFilter = activeFilter === 'all' || collectionName === activeFilter;
    
    const matchesSearch = searchTerm === '' || 
                          (nft.name && nft.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          collectionName.toLowerCase().includes(searchTerm.toLowerCase());
                          
    return matchesFilter && matchesSearch;
  });
  
  // Pagination
  const totalPages = Math.ceil(filteredNFTs.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedNFTs = filteredNFTs.slice(startIndex, startIndex + PAGE_SIZE);
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, sortOption]);
  
  // Handle wallet connection
  const connectWalletAction = () => {
    // Use the wallet adapter modal instead of DOM manipulation
    setVisible(true);
  };
  
  // Handle sort change
  const handleSortChange = (option: string) => {
    setSortOption(option);
    setIsSortPanelOpen(false);
  };
  
  // Handle filter change
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setIsFilterPanelOpen(false);
  };
  
  // Get human-readable sort label
  const getSortLabel = () => {
    switch (sortOption) {
      case 'collection': return 'Collection';
      case 'name': return 'Name';
      case 'recent': return 'Recently Added';
      case 'price': return 'Floor Price';
      default: return 'Collection';
    }
  };

  // Add a function to handle opening the modal
  const handleNFTClick = (nft: NFTMetadata) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };

  return (
    <PageContainer>
      <HeaderSection>
        <PageTitle>
          My NFTs <TitleCount>{userNFTs.length}</TitleCount>
        </PageTitle>
      </HeaderSection>
      
      {isIndexing ? (
        <CenteredStatusContainer>
          <LoadingIndicator size="large" text="Loading your NFT collection..." />
        </CenteredStatusContainer>
      ) : error ? (
        <CenteredStatusContainer>
          <ErrorMessage 
            error={error} 
            onRetry={() => window.location.reload()} 
          />
        </CenteredStatusContainer>
      ) : userNFTs.length === 0 ? (
        <CenteredStatusContainer>
          <ContextualEmptyState
            title="Your Collection is Empty"
            description="Connect your wallet to view your NFTs or add new ones to your collection."
            illustration="/images/empty-box-illustration.svg"
            actions={[
              {
                title: "Refresh NFTs",
                description: "Reload your NFT data",
                action: () => window.location.reload()
              },
              {
                title: "Connect Wallet",
                description: "Connect a different wallet",
                action: connectWalletAction
              }
            ]}
          />
        </CenteredStatusContainer>
      ) : (
        <>
          {/* Collection Wants Section - Only show if user has wants */}
          {collectionWants.length > 0 && (
            <CollectionWantsSection>
              <CollectionWantsHeader>
                <CollectionWantsTitle>
                  <MdCollectionsBookmark />
                  Collection Wants
                </CollectionWantsTitle>
                <AddCollectionButton onClick={() => window.location.href = '/'}>
                  + Add Collection
                </AddCollectionButton>
              </CollectionWantsHeader>
              
              <CollectionWantsGrid>
                {collectionWants.map((want) => (
                  <CollectionWantCard 
                    key={want.collectionId}
                    onClick={() => window.location.href = '/'}
                  >
                    <CollectionWantImage>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, rgba(103, 69, 255, 0.3), rgba(255, 255, 255, 0.1))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        📦
                      </div>
                    </CollectionWantImage>
                    <CollectionWantInfo>
                      <CollectionWantName>
                        {want.collectionName || want.collectionId}
                      </CollectionWantName>
                      <CollectionWantStats>
                        Wanted Collection
                      </CollectionWantStats>
                    </CollectionWantInfo>
                  </CollectionWantCard>
                ))}
              </CollectionWantsGrid>
            </CollectionWantsSection>
          )}
          
          <ControlsContainer>
            <SearchSection>
              <StyledSearchInput 
                onSearch={setSearchTerm}
                placeholder="Search by name or collection..."
              />
            </SearchSection>
            
            <ViewOptionsSection>
              <ViewToggleGroup>
                <ViewToggleButton 
                  $active={viewMode === 'grid'} 
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                >
                  <IoAppsSharp />
                </ViewToggleButton>
                <ViewToggleButton 
                  $active={viewMode === 'compact'} 
                  onClick={() => setViewMode('compact')}
                  aria-label="Compact grid view"
                >
                  <IoAppsSharp style={{ fontSize: '0.9rem' }} />
                </ViewToggleButton>
                <ViewToggleButton 
                  $active={viewMode === 'list'} 
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                >
                  <IoListOutline />
                </ViewToggleButton>
              </ViewToggleGroup>
              
              <div style={{ position: 'relative' }}>
                <FilterButton 
                  $active={isFilterPanelOpen || activeFilter !== 'all'} 
                  onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                >
                  <IoFilterOutline />
                  {activeFilter !== 'all' ? 'Filtered' : 'Filter'}
                </FilterButton>
                
                <FilterPanel $visible={isFilterPanelOpen}>
                  <FilterPanelHeader>
                    <FilterPanelTitle>Filter by Collection</FilterPanelTitle>
                    <CloseButton onClick={() => setIsFilterPanelOpen(false)}>
                      <IoClose />
                    </CloseButton>
                  </FilterPanelHeader>
                  
                  <CollectionList>
                    <CollectionItem 
                      $active={activeFilter === 'all'} 
                      onClick={() => handleFilterChange('all')}
                    >
                      All Collections
                      <CollectionCount>{userNFTs.length}</CollectionCount>
                    </CollectionItem>
                    
                    {collections.map(collection => (
                      <CollectionItem 
                        key={collection} 
                        $active={activeFilter === collection}
                        onClick={() => handleFilterChange(collection)}
                      >
                        {collection}
                        <CollectionCount>{collectionInfo[collection].count}</CollectionCount>
                      </CollectionItem>
                    ))}
                  </CollectionList>
                </FilterPanel>
              </div>
              
              <SortDropdown>
                <SortButton 
                  $active={isSortPanelOpen} 
                  onClick={() => setIsSortPanelOpen(!isSortPanelOpen)}
                >
                  <FaSortAmountDown />
                  {getSortLabel()}
                </SortButton>
                
                <SortPanel $visible={isSortPanelOpen}>
                  <SortOption 
                    $active={sortOption === 'collection'}
                    onClick={() => handleSortChange('collection')}
                  >
                    Collection
                  </SortOption>
                  <SortOption 
                    $active={sortOption === 'name'}
                    onClick={() => handleSortChange('name')}
                  >
                    Name
                  </SortOption>
                  <SortOption 
                    $active={sortOption === 'recent'}
                    onClick={() => handleSortChange('recent')}
                  >
                    Recently Added
                  </SortOption>
                  <SortOption 
                    $active={sortOption === 'price'}
                    onClick={() => handleSortChange('price')}
                  >
                    Floor Price
                  </SortOption>
                </SortPanel>
              </SortDropdown>
            </ViewOptionsSection>
          </ControlsContainer>
          
          <ActiveFiltersBar $visible={activeFilter !== 'all' || searchTerm !== ''}>
            {activeFilter !== 'all' && (
              <ActiveFilter>
                Collection: {activeFilter}
                <RemoveFilterButton onClick={() => setActiveFilter('all')}>
                  <IoClose />
                </RemoveFilterButton>
              </ActiveFilter>
            )}
            
            {searchTerm !== '' && (
              <ActiveFilter>
                Search: {searchTerm}
                <RemoveFilterButton onClick={() => setSearchTerm('')}>
                  <IoClose />
                </RemoveFilterButton>
              </ActiveFilter>
            )}
            
            {(activeFilter !== 'all' || searchTerm !== '') && (
              <ClearFiltersButton onClick={() => {
                setActiveFilter('all');
                setSearchTerm('');
              }}>
                Clear All
              </ClearFiltersButton>
            )}
          </ActiveFiltersBar>
          
          <SectionContainer>
            <SectionHeader>
              <SectionTitle>
                {activeFilter !== 'all' ? activeFilter : 'All Collections'}
              </SectionTitle>
              <StatsLabel>
                {filteredNFTs.length} {filteredNFTs.length === 1 ? 'item' : 'items'}
              </StatsLabel>
            </SectionHeader>
            
            <SectionContent>
              {paginatedNFTs.length === 0 ? (
                <CenteredStatusContainer>
                  <ContextualEmptyState
                    title="No NFTs Found"
                    description="Try adjusting your filters or search term to see more results."
                    illustration="/images/empty-search-illustration.svg"
                    actions={[
                      {
                        title: "Clear Filters",
                        description: "Reset all filters and search terms",
                        action: () => {
                          setActiveFilter('all');
                          setSearchTerm('');
                        }
                      }
                    ]}
                  />
                </CenteredStatusContainer>
              ) : viewMode === 'list' ? (
                <NFTListView>
                  {paginatedNFTs.map((nft: NFTMetadata) => {
                    const collectionName = typeof nft.collection === 'string' 
                      ? nft.collection 
                      : nft.collection?.name || 'Unknown Collection';
                    
                    return (
                      <ListViewItem key={nft.address} onClick={() => handleNFTClick(nft)}>
                        <ListViewImageContainer>
                          {nft.image && (
                            <Image
                              src={nft.image}
                              alt={nft.name || 'NFT'}
                              fill
                              sizes="2.5rem"
                              style={{ objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/placeholder.png';
                              }}
                            />
                          )}
                        </ListViewImageContainer>
                        
                        <ListViewDetails>
                          <NFTInfo>
                            <NFTName>{nft.name || `NFT ${nft.address.slice(0, 6)}...`}</NFTName>
                            <NFTCollection>{collectionName}</NFTCollection>
                          </NFTInfo>
                          
                          <NFTPrice>
                            <PriceLabel>
                              Floor
                              {isLoadingFloorPrices && <MiniSpinner />}
                            </PriceLabel>
                            <PriceValue>
                              {nft.floorPrice ? `${nft.floorPrice} SOL` : 'Unknown'}
                            </PriceValue>
                          </NFTPrice>
                        </ListViewDetails>
                      </ListViewItem>
                    );
                  })}
                </NFTListView>
              ) : (
                <NFTGrid $compact={viewMode === 'compact'}>
                  {paginatedNFTs.map((nft: NFTMetadata) => (
                    <MemoizedNFTCard 
                      key={`nft-${nft.address}`} 
                      nft={nft} 
                    />
                  ))}
                </NFTGrid>
              )}
            </SectionContent>
          </SectionContainer>
          
          {totalPages > 1 && (
            <PaginationControls>
              <PageButton 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
              >
                &laquo;
              </PageButton>
              
              <PageButton 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
              >
                &lt;
              </PageButton>
              
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum;
                
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <PageButton 
                    key={pageNum} 
                    $active={currentPage === pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </PageButton>
                );
              })}
              
              <PageButton 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
              >
                &gt;
              </PageButton>
              
              <PageButton 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
              >
                &raquo;
              </PageButton>
            </PaginationControls>
          )}
          
          {selectedNFT && (
            <NFTTradeModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              nft={selectedNFT}
            />
          )}
        </>
      )}
    </PageContainer>
  );
} 