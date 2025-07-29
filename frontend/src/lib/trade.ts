interface TradeRequest {
  walletAddress: string;
  hasNft: string;
  wantsNft: string;
}

interface TradeResponse {
  trades: any[];
  success: boolean;
  debug?: any;
}

export async function findTrades(request: TradeRequest): Promise<TradeResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  try {
    console.log('Attempting to connect to:', baseUrl);
    console.log('Request payload:', request);

    const response = await fetch(`${baseUrl}/api/trades/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
      mode: 'cors',
      credentials: 'same-origin'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Backend response:', data);
    return data;
  } catch (error) {
    console.error('Error in findTrades:', error);
    throw error;
  }
}

// ... any other trade-related methods ... 