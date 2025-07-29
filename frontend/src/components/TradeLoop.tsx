import React, { useState } from 'react';
import styled from 'styled-components';
import TradeImpactCard from './TradeImpactCard';
import { TradeLoop as TradeLoopType } from '@/types';

interface TradeLoopProps {
  tradeLoopData: TradeLoopType;
  userWallet: string;
}

// Example usage in your trade loop component
export default function TradeLoop({ tradeLoopData, userWallet }: TradeLoopProps) {
  const [showTradeImpact, setShowTradeImpact] = useState(false);
  
  // Find the step where the current user is the sender
  const userStep = tradeLoopData.steps.find(
    (step) => step.from === userWallet
  );
  
  // Function to find the user's position in the trade loop
  const findUserPosition = () => {
    if (!userStep) return -1;
    return tradeLoopData.steps.findIndex(step => step.from === userWallet);
  };
  
  // Get the index of the recipient in the trade loop
  const userPosition = findUserPosition();
  const recipientPosition = (userPosition + 1) % tradeLoopData.steps.length;
  
  // Get the recipient's step
  const recipientStep = userPosition !== -1 ? tradeLoopData.steps[recipientPosition] : null;
  
  // Handler for when a trade loop is successfully formed
  const handleTradeLoopFormed = () => {
    if (userPosition !== -1) {
      setShowTradeImpact(true);
    }
  };
  
  return (
    <div>
      {/* Your existing trade loop visualization */}
      <div className="trade-loop-visualization">
        {/* ... */}
      </div>
      
      {/* Button to trigger the trade impact visualization */}
      <button 
        onClick={handleTradeLoopFormed}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        View Your Trade Impact
      </button>
      
      {/* Trade impact card will appear as a modal */}
      {userStep && recipientStep && (
        <TradeImpactCard
          userNFT={userStep.nfts[0]}
          receivingNFT={recipientStep.nfts[0]}
          onClose={() => setShowTradeImpact(false)}
        />
      )}
    </div>
  );
} 