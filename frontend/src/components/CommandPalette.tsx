import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useRouter } from 'next/navigation';

interface CommandOption {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  options: CommandOption[];
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: ${fadeIn} 0.2s ease;
`;

const PaletteContainer = styled.div`
  width: 100%;
  max-width: 550px;
  background: #1a1a24;
  border-radius: 12px;
  border: 1px solid rgba(103, 69, 255, 0.1);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 1rem 1.25rem;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  color: white;
  font-size: 1rem;
  outline: none;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
`;

const Options = styled.ul`
  margin: 0;
  padding: 0;
  max-height: 350px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(103, 69, 255, 0.3);
    border-radius: 4px;
  }
`;

const Option = styled.li<{ isActive: boolean }>`
  list-style: none;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-left: 3px solid ${props => (props.isActive ? '#6745ff' : 'transparent')};
  background: ${props => (props.isActive ? 'rgba(103, 69, 255, 0.1)' : 'transparent')};
  transition: all 0.1s ease;
  
  &:hover {
    background: rgba(103, 69, 255, 0.05);
  }
`;

const OptionContent = styled.div`
  flex: 1;
`;

const OptionName = styled.div`
  font-weight: 500;
  color: white;
`;

const OptionDescription = styled.div`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.25rem;
`;

const ShortcutHint = styled.div`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  margin: 0.5rem 1.25rem;
  text-align: center;
`;

const NoResults = styled.div`
  padding: 1.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
`;

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, options }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    option.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Focus input when component mounts or when isOpen changes
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  // Key navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        break;
      case 'Enter':
        if (filteredOptions.length > 0) {
          filteredOptions[activeIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [activeIndex, filteredOptions, onClose]);
  
  // Close when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Backdrop onClick={handleBackdropClick}>
      <PaletteContainer>
        <SearchInput
          ref={inputRef}
          placeholder="Search commands... (e.g., 'search nft', 'wallet', 'help')"
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        
        {filteredOptions.length > 0 ? (
          <Options>
            {filteredOptions.map((option, index) => (
              <Option
                key={option.id}
                isActive={index === activeIndex}
                onClick={() => {
                  option.action();
                  onClose();
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {option.icon && <span>{option.icon}</span>}
                <OptionContent>
                  <OptionName>{option.name}</OptionName>
                  {option.description && (
                    <OptionDescription>{option.description}</OptionDescription>
                  )}
                </OptionContent>
              </Option>
            ))}
          </Options>
        ) : (
          <NoResults>No matching commands found</NoResults>
        )}
        
        <ShortcutHint>
          Use ↑↓ to navigate, Enter to select, Esc to dismiss
        </ShortcutHint>
      </PaletteContainer>
    </Backdrop>
  );
};

export default CommandPalette; 