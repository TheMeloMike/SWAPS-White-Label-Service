import React from 'react';
import styled from 'styled-components';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'documentation' | 'help';
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background: #1a1a24;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(103, 69, 255, 0.2);
  animation: slideUp 0.3s ease;
  
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const Header = styled.div`
  padding: 2rem 2rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.75rem;
  background: linear-gradient(90deg, #6745ff, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const Content = styled.div`
  padding: 2rem;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
`;

const Section = styled.div`
  margin-bottom: 2rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  color: white;
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const List = styled.ul`
  margin: 0;
  padding-left: 1.5rem;
  
  li {
    margin-bottom: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
  }
`;

const Highlight = styled.span`
  color: #6745ff;
  font-weight: 600;
`;

const KeyboardShortcut = styled.code`
  background: rgba(103, 69, 255, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
`;

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <Header>
          <Title>
            {type === 'documentation' ? 'SWAPS Documentation' : 'How to Use SWAPS'}
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>
        
        <Content>
          {type === 'documentation' ? (
            <>
              <Section>
                <SectionTitle>What is SWAPS?</SectionTitle>
                <p>
                  SWAPS is a revolutionary NFT trading platform that enables <Highlight>multi-party bartering</Highlight>. 
                  Instead of traditional buy/sell mechanics, SWAPS finds complex trade loops where everyone gets what they want.
                </p>
              </Section>
              
              <Section>
                <SectionTitle>Key Features</SectionTitle>
                <List>
                  <li><strong>Trade Loops:</strong> Find complex multi-party trades automatically</li>
                  <li><strong>No Direct Matches Needed:</strong> Trade across multiple participants</li>
                  <li><strong>Fair Scoring:</strong> Our algorithm ensures everyone benefits equally</li>
                  <li><strong>Collection Trading:</strong> Want any NFT from a collection? We'll find it</li>
                </List>
              </Section>
              
              <Section>
                <SectionTitle>How It Works</SectionTitle>
                <List>
                  <li>Connect your Solana wallet to see your NFTs</li>
                  <li>Search for NFTs or collections you want</li>
                  <li>Our algorithm finds trade loops where you can get them</li>
                  <li>Review and execute trades with one click</li>
                </List>
              </Section>
            </>
          ) : (
            <>
              <Section>
                <SectionTitle>Getting Started</SectionTitle>
                <List>
                  <li>Connect your wallet using the wallet button</li>
                  <li>Search for NFTs by address or collections by name</li>
                  <li>Click on results to see details and find trades</li>
                  <li>Review trade opportunities and execute the ones you like</li>
                </List>
              </Section>
              
              <Section>
                <SectionTitle>Keyboard Shortcuts</SectionTitle>
                <List>
                  <li><KeyboardShortcut>Cmd+K</KeyboardShortcut> (Mac) or <KeyboardShortcut>Ctrl+K</KeyboardShortcut> (PC) - Open command palette</li>
                  <li><KeyboardShortcut>Esc</KeyboardShortcut> - Close modals and dropdowns</li>
                  <li><KeyboardShortcut>↑↓</KeyboardShortcut> - Navigate search results</li>
                  <li><KeyboardShortcut>Enter</KeyboardShortcut> - Select highlighted item</li>
                </List>
              </Section>
              
              <Section>
                <SectionTitle>Pro Tips</SectionTitle>
                <List>
                  <li>The system finds <Highlight>multi-party trade loops</Highlight> automatically</li>
                  <li>Trade quality score shows how fair the trade is (higher is better)</li>
                  <li>You can reject trades you don't want with the × button</li>
                  <li>Pending searches track NFTs you're looking for in the background</li>
                  <li>Use collection search to find any NFT from a specific collection</li>
                </List>
              </Section>
            </>
          )}
        </Content>
      </ModalContent>
    </ModalOverlay>
  );
};

export default HelpModal; 