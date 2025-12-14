import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CryptoPrices {
  [symbol: string]: number;
}

export function useCryptoPrices(symbols: string[]) {
  const [prices, setPrices] = useState<CryptoPrices>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    if (symbols.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('crypto-prices', {
        body: { symbols }
      });

      if (fnError) throw fnError;
      
      if (data?.prices) {
        setPrices(data.prices);
      }
    } catch (err) {
      console.error('Error fetching crypto prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setIsLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    fetchPrices();
    
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const convertUsdToCrypto = useCallback((usdAmount: number, symbol: string): number => {
    const price = prices[symbol.toUpperCase()];
    if (!price || price === 0) return 0;
    return usdAmount / price;
  }, [prices]);

  const convertCryptoToUsd = useCallback((cryptoAmount: number, symbol: string): number => {
    const price = prices[symbol.toUpperCase()];
    if (!price) return 0;
    return cryptoAmount * price;
  }, [prices]);

  return {
    prices,
    isLoading,
    error,
    refetch: fetchPrices,
    convertUsdToCrypto,
    convertCryptoToUsd,
  };
}