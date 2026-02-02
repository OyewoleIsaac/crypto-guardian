import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentMethod {
  id: string;
  crypto_type: string;
  crypto_name: string;
  wallet_address: string;
  is_enabled: boolean;
  icon_class: string | null;
  network: string | null;
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('payment_methods')
        .select('*')
        .order('crypto_type', { ascending: true });

      if (fetchError) throw fetchError;
      
      setMethods(data || []);
    } catch (err) {
      console.error('Error fetching payment methods:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch payment methods');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  return {
    methods,
    enabledMethods: methods.filter(m => m.is_enabled),
    isLoading,
    error,
    refetch: fetchMethods,
  };
}