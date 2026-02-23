import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveInvestments } from './useActiveInvestments';

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  wallet_address: string;
  crypto_type: string;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WithdrawalEligibility {
  canWithdraw: boolean;
  reason: string;
  availableBalance: number;
  daysUntilEligible: number | null;
  hasActiveInvestment: boolean;
}

export function useWithdrawals() {
  const { user } = useAuth();
  const { activeInvestments, isLoading: investmentsLoading } = useActiveInvestments();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setWithdrawals((data || []) as Withdrawal[]);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch withdrawals');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  // Check withdrawal eligibility: can withdraw if balance > 0
  const checkEligibility = useCallback(async (): Promise<WithdrawalEligibility> => {
    if (!user) {
      return {
        canWithdraw: false,
        reason: 'Please log in to check withdrawal eligibility.',
        availableBalance: 0,
        daysUntilEligible: null,
        hasActiveInvestment: false,
      };
    }

    const { data: investment, error: balanceError } = await supabase
      .from('investments')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (balanceError) {
      console.error('Error fetching balance:', balanceError);
    }

    const availableBalance = Number(investment?.balance || 0);

    if (availableBalance <= 0) {
      return {
        canWithdraw: false,
        reason: 'No balance available for withdrawal. Make a deposit first.',
        availableBalance,
        daysUntilEligible: null,
        hasActiveInvestment: activeInvestments.length > 0,
      };
    }

    return {
      canWithdraw: true,
      reason: 'You can withdraw from your available balance.',
      availableBalance,
      daysUntilEligible: null,
      hasActiveInvestment: activeInvestments.length > 0,
    };
  }, [user, activeInvestments]);

  // Submit withdrawal: deduct balance immediately, create pending withdrawal
  const submitWithdrawal = async (
    amount: number,
    walletAddress: string,
    cryptoType: string = 'USDT',
    network: string | null = null
  ) => {
    if (!user) throw new Error('User not authenticated');

    const eligibility = await checkEligibility();
    if (!eligibility.canWithdraw) {
      throw new Error(eligibility.reason);
    }

    if (amount > eligibility.availableBalance) {
      throw new Error('Insufficient balance for this withdrawal amount.');
    }

    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero.');
    }

    // 1. Deduct from balance immediately
    const { data: investment } = await supabase
      .from('investments')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentBalance = Number(investment?.balance || 0);
    const newBalance = Math.max(0, currentBalance - amount);

    const { error: balanceError } = await supabase
      .from('investments')
      .update({ balance: newBalance })
      .eq('user_id', user.id);

    if (balanceError) throw balanceError;

    // 2. Create pending withdrawal
    const { data, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount,
        wallet_address: walletAddress,
        crypto_type: cryptoType,
        network,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // Refund on insert failure
      await supabase.from('investments').update({ balance: currentBalance }).eq('user_id', user.id);
      throw error;
    }

    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal of $${amount.toFixed(2)} (${cryptoType}) is pending. Processing typically takes 1–3 hours, or up to 3 business days in some cases.`,
      type: 'info',
    });

    await fetchWithdrawals();
    return data;
  };

  return {
    withdrawals,
    isLoading: isLoading || investmentsLoading,
    error,
    refetch: fetchWithdrawals,
    checkEligibility,
    submitWithdrawal,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'pending'),
    approvedWithdrawals: withdrawals.filter(w => w.status === 'approved'),
    rejectedWithdrawals: withdrawals.filter(w => w.status === 'rejected'),
  };
}
