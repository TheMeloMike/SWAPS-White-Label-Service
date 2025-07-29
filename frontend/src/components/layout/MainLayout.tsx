'use client';

import React, { ReactNode, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import styled, { keyframes, css } from 'styled-components';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import AnimatedTitle from '@/components/AnimatedTitle';
import EnhancedRippleButton from '@/components/common/EnhancedRippleButton';
import { useWallet } from '@solana/wallet-adapter-react';
import { IoWalletOutline, IoClose, IoCopy, IoCheckmarkCircle, IoGrid, IoArrowForward } from 'react-icons/io5';
import { LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { NFTService } from '@/services/nft';
import { NFTMetadata } from '@/types/nft';
import { fixImageUrl, handleImageError, createDataURIPlaceholder, SVG_PLACEHOLDER_PREFIX, DEFAULT_IMAGE_PLACEHOLDER } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';
import NFTTradeModal from '@/components/NFTTradeModal';
import UnifiedSearchBar from '@/components/UnifiedSearchBar';

// Import wallet button with dynamic import to prevent SSR hydration issues
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

interface MainLayoutProps {
  children: ReactNode;
}

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Wallet modal animations
const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Layout container
const Container = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme?.colors?.background || '#111314'};
  /* Global font set in layout.tsx via body className */
`;

// Main content container
const Main = styled.main`
  flex: 1;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  font-family: var(--font-roboto-mono), monospace; /* Default body font */
  
  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

// Header styles - Updated to be more sleek and modern
const Header = styled.header`
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 1000; /* Lower than sticky search */
  background-color: rgba(17, 19, 20, 0.8);
  font-family: var(--font-roboto-mono), monospace;
  overflow: visible; /* Allow dropdown to overflow */
  min-height: 60px; /* Ensure consistent header height */
  display: flex;
  align-items: center;
  
  @media (max-width: 768px) {
    padding: 0.75rem 1rem;
    min-height: 56px; /* Slightly smaller on mobile */
  }
`;

const HeaderContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  overflow: visible; /* Allow dropdown to overflow */
  width: 100%;
  height: 100%; /* Take full header height */
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-shrink: 0;
  height: 100%; /* Ensure it takes full header height */
  min-height: 42px; /* Match search bar height for consistent alignment */
`;

// Navigation styles - Updated with smoother hover effects
const Navigation = styled.nav`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.5rem;
  flex-shrink: 0;
  height: 100%; /* Take full header height */
  min-height: 42px; /* Match search bar height */
  
  @media (max-width: 1024px) {
    gap: 1rem;
  }
  
  @media (max-width: 768px) {
    gap: 0.75rem;
  }
  
  @media (max-width: 640px) {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
    height: auto; /* Allow natural height on mobile */
  }
`;

// Wallet icon button styling
const WalletIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme?.colors?.surface || '#1f2128'};
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
  border-radius: ${({ theme }) => theme?.borderRadius?.full || '9999px'};
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
  margin-right: 0.75rem;
  transition: all 0.25s ease;
  
  &:hover {
    background-color: ${({ theme }) => (theme?.colors?.primary || '#6745FF') + '10'};
    border-color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(103, 69, 255, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  svg {
    font-size: 1.25rem;
  }
  
  @media (max-width: 640px) {
    width: 2.25rem;
    height: 2.25rem;
    margin-right: 0.5rem;
    
    svg {
      font-size: 1.1rem;
    }
  }
`;

// Updated NavGroup to include spacing for wallet buttons
const NavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  height: 100%; /* Take full navigation height */
  
  @media (max-width: 640px) {
    gap: 0.5rem;
    height: auto; /* Allow natural height on mobile */
  }
`;

const WalletButtonGroup = styled.div`
  display: flex;
  align-items: center;
  height: 100%; /* Take full navigation height */
  
  @media (max-width: 640px) {
    height: auto; /* Allow natural height on mobile */
  }
`;

const NavLink = styled(Link)<{ $isActive: boolean }>`
  color: ${({ $isActive, theme }) => 
    $isActive ? theme?.colors?.primary || '#6745FF' : theme?.colors?.textSecondary || '#a0a0b0'};
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-weight: ${({ $isActive }) => $isActive ? 600 : 500};
  font-size: 0.95rem;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
    background: rgba(255, 255, 255, 0.05);
  }
  
  ${({ $isActive, theme }) => $isActive && css`
    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0.75rem;
      right: 0.75rem;
      height: 2px;
      background: ${theme?.colors?.primary || '#6745FF'};
      border-radius: 2px;
      animation: ${fadeIn} 0.3s ease forwards;
    }
  `}
  
  @media (max-width: 640px) {
    padding: 0.5rem;
    font-size: 0.85rem;
  }
`;

// Updated Wallet Button styling to match Magic Eden
const WalletButtonContainer = styled.div`
  .wallet-adapter-button {
    background-color: ${({ theme }) => theme?.colors?.surface || '#1f2128'};
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
    border-radius: ${({ theme }) => theme?.borderRadius?.full || '9999px'};
    font-size: 0.95rem;
    font-weight: ${({ theme }) => theme?.typography?.fontWeight?.medium || 500};
    padding: 0.6rem 1.2rem;
    height: auto;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.25s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    font-family: var(--font-roboto-mono), monospace;
    
    &:hover {
      background-color: ${({ theme }) => (theme?.colors?.primary || '#6745FF') + '10'};
      border-color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(103, 69, 255, 0.2);
    }
    
    &:active {
      transform: translateY(0);
    }
  }

  @media (max-width: 640px) {
    .wallet-adapter-button {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
    }
  }
`;

// Custom styled AnimatedTitle (Logo)
const StyledAnimatedTitle = styled(AnimatedTitle)`
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-shadow: 0 0 10px rgba(103, 69, 255, 0.3);
  font-family: var(--font-michroma), sans-serif; /* Logo explicitly uses Michroma */
  line-height: 1; /* Ensure tight line height for perfect centering */
  display: flex;
  align-items: center;
  margin: 0; /* Remove any default margins */
  padding: 0; /* Remove any default padding */
`;

// Wallet info modal styling
const WalletInfoModal = styled.div`
  position: absolute;
  top: 4rem;
  right: 1.5rem;
  background-color: ${({ theme }) => theme?.colors?.background || '#111314'};
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0;
  width: 320px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: ${slideDown} 0.3s ease;
  
  &::before {
    content: '';
    position: absolute;
    top: -6px;
    right: 2.5rem;
    width: 12px;
    height: 12px;
    background-color: ${({ theme }) => theme?.colors?.background || '#111314'};
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    transform: rotate(45deg);
  }
`;

const WalletInfoHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem 1rem 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const WalletInfoTitle = styled.h3`
  font-size: 1rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
  margin: 0;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#a0a0b0'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
  }
  
  svg {
    font-size: 1.25rem;
  }
`;

const WalletInfoContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 1rem;
`;

const WalletAddressContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.05);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
`;

const WalletAddressText = styled.p`
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
  margin: 0;
  font-family: var(--font-roboto-mono), monospace;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CopyButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#a0a0b0'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  }
  
  svg {
    font-size: 1.25rem;
  }
`;

const BalanceContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  border-radius: 8px;
`;

const BalanceLabel = styled.span`
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#a0a0b0'};
`;

const BalanceValue = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#ffffff'};
`;

// SOLANA_RPC_ENDPOINT (add near other constants)
const SOLANA_RPC_ENDPOINT = 'https://rpc.helius.xyz/?api-key=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7';

const WalletInfoSection = styled.div`
  margin-top: 1rem;
  padding-top: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0;
  max-height: 350px;
  overflow-y: auto;
  position: relative;
  
  &::-webkit-scrollbar {
    width: 5px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background-color: ${({ theme }) => theme?.colors?.background || '#111314'};
  padding: 1rem 1rem 0.75rem;
  margin-bottom: 0;
  z-index: 5;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
`;

const SectionTitle = styled.h4`
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#a0a0b0'};
  margin: 0;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  svg {
    font-size: 1rem;
  }
`;

const ViewAllLink = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s ease;
  
  &:hover {
    text-decoration: underline;
  }
`;

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.75rem 1rem 1rem;
`;

const NFTItem = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  }
`;

const NFTImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const EmptyStateMessage = styled.div`
  text-align: center;
  padding: 1rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#a0a0b0'};
  font-size: 0.75rem;
`;

const LoadingSpinner = styled.div`
  position: relative;
  width: 24px;
  height: 24px;
  margin: 1rem auto;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    border-radius: 50%;
  }
  
  &::before {
    width: 100%;
    height: 100%;
    background: linear-gradient(to right, ${({ theme }) => theme?.colors?.primary || '#6745FF'} 0%, transparent 100%);
    animation: rotate 2s linear infinite;
  }
  
  &::after {
    width: 75%;
    height: 75%;
    background: ${({ theme }) => theme?.colors?.background || '#111314'};
    top: 12.5%;
    left: 12.5%;
  }
  
  @keyframes rotate {
    to { transform: rotate(360deg); }
  }
`;

// New stateful component for rendering NFT images in the wallet modal grid
const WalletNftDisplayImage: React.FC<{ nft: NFTMetadata }> = ({ nft }) => {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(() => 
    createDataURIPlaceholder(nft?.name || 'NFT', nft?.address)
  );
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    if (!nft || !nft.address) {
      setCurrentImageSrc(createDataURIPlaceholder('Invalid NFT'));
      setIsImageLoading(false);
      return;
    }

    let isActive = true;
    const initialPlaceholder = createDataURIPlaceholder(nft.name || 'NFT', nft.address);
    setCurrentImageSrc(initialPlaceholder);
    setIsImageLoading(true);

    const targetSrc = fixImageUrl(nft.image, nft.address);

    if (targetSrc.startsWith(SVG_PLACEHOLDER_PREFIX) || targetSrc.endsWith(DEFAULT_IMAGE_PLACEHOLDER)) {
      if (isActive) {
        setCurrentImageSrc(targetSrc);
        setIsImageLoading(false);
      }
    } else {
      setCurrentImageSrc(targetSrc); // Set for the <img> tag to attempt loading
      const img = new window.Image();
      img.src = targetSrc;
      img.onload = () => {
        if (isActive) {
          // currentImageSrc is already targetSrc
          setIsImageLoading(false);
        }
      };
      img.onerror = () => {
        if (isActive) {
          // Let the onError prop of the rendered <NFTImage> call the global handleImageError
          // This effect's onerror is a fallback for the new window.Image() test load.
          // If it fails here, the rendered <NFTImage> will also fail and its onError will trigger.
          // For safety, ensure currentImageSrc is a placeholder if this path is hit.
          setCurrentImageSrc(createDataURIPlaceholder(nft.name || 'Error', nft.address));
          setIsImageLoading(false);
        }
      };
    }

    return () => {
      isActive = false;
    };
  }, [nft]); // Depend on the whole nft object

  const onImageErrorHandler = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgElement = event.currentTarget;
    handleImageError(event, imgElement.src, nft.name, nft.address);
    setCurrentImageSrc(imgElement.src); // Reflect placeholder set by handleImageError
    setIsImageLoading(false);
  };

  return (
    <NFTImage 
      key={currentImageSrc} // Helps React differentiate if src changes from placeholder to real URL
      src={currentImageSrc} 
      alt={nft.name || 'NFT'}
      onError={onImageErrorHandler}
      data-mint-address={nft.address} // For tracking in imageUtils
    />
  );
};

const CenterSection = styled.div<{ $showSearch: boolean }>`
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 450px; /* Sweet spot between 400-500px */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible; /* Ensure dropdown can overflow */
  opacity: ${props => props.$showSearch ? 1 : 0};
  transform: translateY(${props => props.$showSearch ? '0' : '-10px'});
  pointer-events: ${props => props.$showSearch ? 'auto' : 'none'};
  margin: 0 1.75rem; /* Slightly more breathing room */
  z-index: 10000; /* Higher than header */
  position: relative;
  
  @media (max-width: 1024px) {
    max-width: 350px; /* Better proportion for medium screens */
    margin: 0 1.25rem;
  }
  
  @media (max-width: 768px) {
    max-width: 280px; /* More usable on tablets */
    margin: 0 1rem;
  }
  
  @media (max-width: 640px) {
    display: none; /* Hide sticky search on mobile to save space */
  }
`;

const StickySearchContainer = styled.div`
  width: 100%;
  position: relative;
  z-index: 10000;
  
  /* Create a new stacking context */
  transform: translateZ(0);
  
  /* Make the search bar more compact for header */
  & > div {
    position: relative;
    z-index: 10000;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
  
  /* Style the search wrapper with perfect proportions */
  & > div > div:first-child {
    border-radius: 16px !important; /* Balanced radius */
    height: 42px !important; /* Perfect height for readability */
    border-width: 1.5px !important; /* Slightly thicker for definition */
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15) !important; /* Balanced shadow */
    
    &:focus-within {
      transform: translateY(-1px) !important;
      box-shadow: 
        0 6px 20px rgba(0, 0, 0, 0.2) !important,
        0 0 0 1px rgba(103, 69, 255, 0.4) !important,
        0 0 24px rgba(103, 69, 255, 0.2) !important; /* Balanced glow */
    }
    
    &:hover:not(:focus-within) {
      transform: translateY(-0.5px) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18) !important;
    }
  }
  
  /* Perfect input sizing */
  & input {
    font-size: 0.9rem !important; /* Readable but compact */
    padding: 0.75rem 1.25rem !important; /* Comfortable padding */
    height: 42px !important;
    font-weight: 500 !important;
  }
  
  /* Proportioned search icon */
  & > div > div:first-child > div:first-child {
    padding: 0 1rem !important; /* Balanced icon spacing */
    
    svg {
      width: 18px !important; /* Perfect icon size */
      height: 18px !important;
    }
  }
  
  /* Well-sized type indicator */
  & > div > div:first-child > div:last-child {
    font-size: 0.7rem !important; /* Readable but subtle */
    padding: 0.2rem 0.6rem !important; /* Comfortable padding */
    right: 14px !important; /* Proper positioning */
    font-weight: 600 !important;
  }
  
  /* Style the dropdown with perfect proportions */
  & > div > div:last-child {
    position: absolute !important;
    z-index: 10001 !important;
    background: rgba(18, 20, 24, 0.98) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 14px !important; /* Slightly smaller than search bar */
    backdrop-filter: blur(20px) !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35) !important; /* Balanced shadow */
    max-height: 320px !important; /* Good viewing area */
    overflow-y: auto !important;
    top: calc(100% + 8px) !important; /* Perfect spacing */
    left: 0 !important;
    right: 0 !important;
  }
  
  /* Ensure visibility when dropdown should be shown */
  & > div > div:last-child[style*="opacity: 1"] {
    display: block !important;
    visibility: visible !important;
    pointer-events: auto !important;
  }
`;

// Custom header search component that ensures dropdown works
const HeaderSearchBar: React.FC<{ onResult: (result: any) => void; disabled: boolean }> = ({ onResult, disabled }) => {
  return (
    <UnifiedSearchBar
      onResult={onResult}
      placeholder="Search NFTs or collections..."
      disabled={disabled}
    />
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [showWalletInfo, setShowWalletInfo] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [userNFTs, setUserNFTs] = useState<NFTMetadata[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showStickySearch, setShowStickySearch] = useState(false);
  
  // Scroll detection for sticky search bar
  useEffect(() => {
    // Only show sticky search on the home page
    if (pathname !== '/') {
      setShowStickySearch(false);
      return;
    }

    const handleScroll = () => {
      // Look for the main search container on the page
      const mainSearchContainer = document.querySelector('[data-main-search]');
      if (mainSearchContainer) {
        const rect = mainSearchContainer.getBoundingClientRect();
        // Show sticky search when main search is above viewport (with some buffer)
        setShowStickySearch(rect.bottom < 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);
  
  // Handle sticky search result
  const handleStickySearchResult = (result: any) => {
    console.log('Sticky search result:', result);
    
    // Dispatch a custom event that the home page can listen to
    const event = new CustomEvent('stickySearchResult', {
      detail: result,
      bubbles: true
    });
    document.dispatchEvent(event);
    
    // Also scroll to the main search area to show the results
    const mainSearchContainer = document.querySelector('[data-main-search]');
    if (mainSearchContainer) {
      mainSearchContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  const handleWalletIconClick = () => {
    setShowWalletInfo(!showWalletInfo);
  };
  
  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  // Fetch SOL balance when wallet is connected and modal is opened
  useEffect(() => {
    if (publicKey && connected && showWalletInfo) {
      const fetchBalance = async () => {
        try {
          const connection = new Connection(SOLANA_RPC_ENDPOINT);
          const balance = await connection.getBalance(publicKey);
          setSolBalance(balance / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Error fetching SOL balance:', error);
          setSolBalance(null);
        }
      };
      fetchBalance();
    }
  }, [publicKey, connected, showWalletInfo]);
  
  // Fetch user NFTs when wallet is connected and modal is opened
  useEffect(() => {
    if (publicKey && connected && showWalletInfo) {
      const fetchNFTs = async () => {
        setIsLoadingNFTs(true);
        try {
          const nftService = NFTService.getInstance();
          const nfts = await nftService.fetchUserNFTs(publicKey.toString());
          setUserNFTs(nfts);
        } catch (error) {
          console.error('Error fetching user NFTs:', error);
          setUserNFTs([]);
        } finally {
          setIsLoadingNFTs(false);
        }
      };
      fetchNFTs();
    }
  }, [publicKey, connected, showWalletInfo]);
  
  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showWalletInfo && 
          !(event.target as Element).closest('.wallet-info-modal') && 
          !(event.target as Element).closest('.wallet-icon-button')) {
        setShowWalletInfo(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWalletInfo]);
  
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  };
  
  const navigateToInventory = () => {
    setShowWalletInfo(false);
    router.push('/inventory');
  };
  
  const handleNFTClick = (nft: NFTMetadata) => {
    setSelectedNFT(nft);
    setShowTradeModal(true);
    setShowWalletInfo(false); // Close the wallet info modal
  };
  
  const handleTradeModalClose = () => {
    setShowTradeModal(false);
    setSelectedNFT(null);
  };
  
  return (
    <Container>
      <Header>
        <HeaderContent>
          <LogoContainer>
            <StyledAnimatedTitle text="SWAPS" />
          </LogoContainer>
          
          <CenterSection $showSearch={showStickySearch && connected}>
            <StickySearchContainer>
              <HeaderSearchBar
                onResult={handleStickySearchResult}
                disabled={!connected}
              />
            </StickySearchContainer>
          </CenterSection>
          
          <Navigation>
            <NavGroup>
              <NavLink href="/" $isActive={pathname === '/'}>
                Home
              </NavLink>
              <NavLink href="/inventory" $isActive={pathname === '/inventory'}>
                My NFTs
              </NavLink>
              <NavLink href="/ai-assistant" $isActive={pathname === '/ai-assistant'}>
                AI Assistant
              </NavLink>
            </NavGroup>
            
            <WalletButtonGroup>
              {connected && publicKey && (
                <>
                  <WalletIconButton 
                    onClick={handleWalletIconClick}
                    className="wallet-icon-button"
                  >
                    <IoWalletOutline />
                  </WalletIconButton>
                  
                  {showWalletInfo && (
                    <WalletInfoModal className="wallet-info-modal">
                      <WalletInfoHeader>
                        <WalletInfoTitle>Wallet Info</WalletInfoTitle>
                        <CloseButton onClick={() => setShowWalletInfo(false)}>
                          <IoClose />
                        </CloseButton>
                      </WalletInfoHeader>
                      
                      <WalletInfoContent>
                        <WalletAddressContainer>
                          <WalletAddressText>
                            {publicKey.toString()}
                          </WalletAddressText>
                          <CopyButton onClick={handleCopyAddress}>
                            {copied ? <IoCheckmarkCircle color="#4caf50" /> : <IoCopy />}
                          </CopyButton>
                        </WalletAddressContainer>
                        
                        <BalanceContainer>
                          <BalanceLabel>SOL Balance</BalanceLabel>
                          <BalanceValue>
                            {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : 'Loading...'}
                          </BalanceValue>
                        </BalanceContainer>
                      </WalletInfoContent>
                      
                      <WalletInfoSection>
                        <SectionHeader>
                          <SectionTitle>
                            <IoGrid /> My NFTs
                          </SectionTitle>
                          <ViewAllLink onClick={navigateToInventory}>
                            View All <IoArrowForward />
                          </ViewAllLink>
                        </SectionHeader>
                        
                        {isLoadingNFTs ? (
                          <LoadingSpinner />
                        ) : userNFTs.length > 0 ? (
                          <NFTGrid>
                            {userNFTs.map((nft) => (
                              <NFTItem key={nft.address} onClick={() => handleNFTClick(nft)}>
                                <WalletNftDisplayImage nft={nft} />
                              </NFTItem>
                            ))}
                          </NFTGrid>
                        ) : (
                          <EmptyStateMessage>
                            No NFTs found in your wallet.
                          </EmptyStateMessage>
                        )}
                      </WalletInfoSection>
                    </WalletInfoModal>
                  )}
                </>
              )}
              <WalletButtonContainer>
                <WalletMultiButton />
              </WalletButtonContainer>
            </WalletButtonGroup>
          </Navigation>
        </HeaderContent>
      </Header>
      
      <Main>{children}</Main>
      
      {/* Trade Modal */}
      {selectedNFT && (
        <NFTTradeModal
          isOpen={showTradeModal}
          onClose={handleTradeModalClose}
          nft={selectedNFT}
        />
      )}
    </Container>
  );
};

export default MainLayout; 