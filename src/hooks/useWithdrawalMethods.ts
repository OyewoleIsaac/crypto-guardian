import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WithdrawalMethod {
  id: string;
  user_id: string;
  crypto_type: string;
  wallet_address: string;
  network: string | null;
  label: string | null;
  created_at: string;
}

export function useWithdrawalMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMethods = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_withdrawal_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMethods((data || []) as WithdrawalMethod[]);
    } catch (err) {
      console.error('Error fetching withdrawal methods:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const saveMethod = async (
    cryptoType: string,
    walletAddress: string,
    network: string | null,
    label: string | null
  ) => {
    if (!user) throw new Error('Not authenticated');

    // Client-side duplicate check before hitting DB
    const duplicate = methods.find(
      m => m.crypto_type === cryptoType && m.wallet_address === walletAddress
    );
    if (duplicate) {
      throw new Error(
        `A ${cryptoType} wallet with this address is already saved${duplicate.label ? ` as "${duplicate.label}"` : ''}.`
      );
    }

    const { error } = await supabase
      .from('user_withdrawal_methods')
      .insert({
        user_id: user.id,
        crypto_type: cryptoType,
        wallet_address: walletAddress,
        network: network || null,
        label: label?.trim() || null,
      });

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') {
        throw new Error(`This ${cryptoType} wallet address is already saved.`);
      }
      throw error;
    }

    await fetchMethods();
  };

  const deleteMethod = async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('user_withdrawal_methods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;
    await fetchMethods();
  };

  return {
    methods,
    isLoading,
    refetch: fetchMethods,
    saveMethod,
    deleteMethod,
  };
}
