import React from 'react';
import styled, { keyframes } from 'styled-components';
import GlassmorphicCard from './GlassmorphicCard';

interface ActionItem {
  title: string;
  description: string;
  icon?: string;
  action?: () => void;
}

interface ContextualEmptyStateProps {
  title: string;
  description?: string;
  actions?: ActionItem[];
  illustration?: string;
  className?: string;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  animation: ${fadeIn} 0.4s ease-out;
`;

const Title = styled.h3`
  font-size: 1.5rem;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: 0.75rem;
`;

const Description = styled.p`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: 2rem;
  max-width: 600px;
`;

const Illustration = styled.div`
  width: 120px;
  height: 120px;
  margin-bottom: 1.5rem;
  animation: ${bounce} 3s ease-in-out infinite;
`;

const ActionList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  width: 100%;
  max-width: 900px;
`;

const ActionCard = styled(GlassmorphicCard)`
  transition: all 0.3s ease;
  cursor: pointer;
  text-align: left;
  
  &:hover {
    transform: translateY(-3px) scale(1.01);
  }
`;

const ActionTitle = styled.h4`
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: 0.5rem;
`;

const ActionDescription = styled.p`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ContextualEmptyState: React.FC<ContextualEmptyStateProps> = ({
  title,
  description,
  actions = [],
  illustration,
  className
}) => {
  return (
    <Container className={className}>
      {illustration && (
        <Illustration>
          <img src={illustration} alt="Illustration" width="100%" height="100%" />
        </Illustration>
      )}
      
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}
      
      {actions.length > 0 && (
        <ActionList>
          {actions.map((action, index) => (
            <ActionCard 
              key={index}
              onClick={action.action}
              padding="1.25rem"
              $highlighted={index === 0}
            >
              <ActionTitle>{action.title}</ActionTitle>
              <ActionDescription>{action.description}</ActionDescription>
            </ActionCard>
          ))}
        </ActionList>
      )}
    </Container>
  );
};

export default ContextualEmptyState; 