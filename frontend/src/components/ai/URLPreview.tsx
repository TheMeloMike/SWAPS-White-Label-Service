'use client';

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

interface URLPreviewProps {
  url: string;
  onLoad?: () => void;
}

interface URLMetadata {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
  favicon: string;
}

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const PreviewCard = styled.a`
  display: block;
  background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
  border: 1px solid rgba(123, 97, 255, 0.3);
  border-radius: 12px;
  padding: 0;
  margin: 16px 0;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: all 0.3s ease;
  animation: ${fadeIn} 0.4s ease-out;
  max-width: 500px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(123, 97, 255, 0.3);
    border-color: rgba(123, 97, 255, 0.5);
  }
`;

const PreviewImage = styled.div<{ $backgroundImage: string }>`
  height: 180px;
  background-image: url(${props => props.$backgroundImage});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: linear-gradient(transparent, rgba(26, 26, 46, 0.8));
  }
`;

const PreviewContent = styled.div`
  padding: 16px;
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const SiteIcon = styled.img`
  width: 18px;
  height: 18px;
  border-radius: 3px;
  flex-shrink: 0;
  filter: invert(1); /* Make the black X logo white for dark theme */
`;

const SiteName = styled.span`
  font-size: 12px;
  color: #8b8b9e;
  font-weight: 500;
`;

const PreviewTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PreviewDescription = styled.p`
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #b8b8c8;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PreviewURL = styled.span`
  font-size: 12px;
  color: #7b61ff;
  font-weight: 500;
`;

const LoadingCard = styled.div`
  background: rgba(26, 26, 46, 0.5);
  border: 1px solid rgba(123, 97, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  max-width: 500px;
  
  .loading-title {
    height: 20px;
    background: linear-gradient(90deg, rgba(123, 97, 255, 0.1), rgba(123, 97, 255, 0.2), rgba(123, 97, 255, 0.1));
    background-size: 200% 100%;
    border-radius: 4px;
    margin-bottom: 8px;
    animation: shimmer 2s infinite;
  }
  
  .loading-description {
    height: 14px;
    background: linear-gradient(90deg, rgba(123, 97, 255, 0.1), rgba(123, 97, 255, 0.2), rgba(123, 97, 255, 0.1));
    background-size: 200% 100%;
    border-radius: 4px;
    margin-bottom: 6px;
    animation: shimmer 2s infinite;
  }
  
  .loading-url {
    height: 12px;
    width: 60%;
    background: linear-gradient(90deg, rgba(123, 97, 255, 0.1), rgba(123, 97, 255, 0.2), rgba(123, 97, 255, 0.1));
    background-size: 200% 100%;
    border-radius: 4px;
    animation: shimmer 2s infinite;
  }
  
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

const ErrorCard = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin: 16px 0;
  max-width: 500px;
  color: #ef4444;
  font-size: 14px;
  text-align: center;
`;

// URL metadata fetching service
const fetchURLMetadata = async (url: string): Promise<URLMetadata | null> => {
  try {
    console.log('Fetching metadata for URL:', url);
    
    // Use the backend API to fetch metadata and bypass CORS
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/ai/url-metadata?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.metadata) {
      console.log('Successfully fetched metadata:', data.metadata);
      return data.metadata;
    } else {
      console.warn('Backend returned unsuccessful response:', data);
      // Use fallback metadata if backend fails
      return data.metadata || null;
    }
    
  } catch (error) {
    console.error('Error fetching URL metadata:', error);
    
    // Fallback to basic metadata generation
    try {
      const domain = new URL(url).hostname;
      return {
        title: domain,
        description: `Visit ${domain}`,
        image: '',
        siteName: domain,
        url: url,
        favicon: `https://www.google.com/s2/favicons?sz=64&domain=${domain}`
      };
    } catch (parseError) {
      console.error('Error parsing URL for fallback:', parseError);
      return null;
    }
  }
};

const URLPreview: React.FC<URLPreviewProps> = ({ url, onLoad }) => {
  const [metadata, setMetadata] = useState<URLMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const data = await fetchURLMetadata(url);
        if (data) {
          setMetadata(data);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
        if (onLoad) onLoad();
      }
    };

    loadMetadata();
  }, [url, onLoad]);

  if (loading) {
    return (
      <LoadingCard>
        <div className="loading-title" />
        <div className="loading-description" />
        <div className="loading-description" style={{ width: '80%' }} />
        <div className="loading-url" />
      </LoadingCard>
    );
  }

  if (error || !metadata) {
    return (
      <ErrorCard>
        📄 Unable to load preview for this link
      </ErrorCard>
    );
  }

  return (
    <PreviewCard href={metadata.url} target="_blank" rel="noopener noreferrer">
      {metadata.image && metadata.image.trim() && (
        <PreviewImage $backgroundImage={metadata.image} />
      )}
      <PreviewContent>
        <PreviewHeader>
          {metadata.favicon && (
            <SiteIcon src={metadata.favicon} alt="" />
          )}
          <SiteName>{metadata.siteName}</SiteName>
        </PreviewHeader>
        <PreviewTitle>{metadata.title}</PreviewTitle>
        {metadata.description && (
          <PreviewDescription>{metadata.description}</PreviewDescription>
        )}
        <PreviewURL>{metadata.url}</PreviewURL>
      </PreviewContent>
    </PreviewCard>
  );
};

export default URLPreview; 