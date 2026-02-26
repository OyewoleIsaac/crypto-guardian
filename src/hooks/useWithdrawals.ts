import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  // Available balance = actual balance minus all pending (not yet approved) withdrawals
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

    const [{ data: investment }, { data: pending }] = await Promise.all([
      supabase
        .from('investments')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('withdrawals')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending'),
    ]);

    const actualBalance = Number(investment?.balance || 0);
    const pendingTotal = (pending || []).reduce((sum, w) => sum + Number(w.amount), 0);
    const availableBalance = Math.max(0, actualBalance - pendingTotal);

    if (availableBalance <= 0) {
      const reason = pendingTotal > 0
        ? `Your full balance is reserved for ${pending!.length} pending withdrawal${pending!.length > 1 ? 's' : ''}. Wait for them to be processed or contact support.`
        : 'No balance available for withdrawal. Make a deposit or earn ROI first.';
      return {
        canWithdraw: false,
        reason,
        availableBalance,
        daysUntilEligible: null,
        hasActiveInvestment: false,
      };
    }

    return {
      canWithdraw: true,
      reason: 'You can withdraw from your available balance.',
      availableBalance,
      daysUntilEligible: null,
      hasActiveInvestment: false,
    };
  }, [user]);

  // Submit withdrawal: only creates the request — balance is deducted by admin on approval
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

    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero.');
    }

    if (amount > eligibility.availableBalance) {
      throw new Error(
        `Amount exceeds your available balance of $${eligibility.availableBalance.toFixed(2)}.`
      );
    }

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

    if (error) throw error;

    // Notify the user (RPC bypasses notifications RLS)
    await supabase.rpc('create_system_notification', {
      p_user_id: user.id,
      p_title: 'Withdrawal Request Submitted',
      p_message: `Your withdrawal of $${amount.toFixed(2)} (${cryptoType}) has been submitted and is pending admin approval.`,
      p_type: 'info',
    });

    await fetchWithdrawals();
    return data;
  };

  return {
    withdrawals,
    isLoading,
    error,
    refetch: fetchWithdrawals,
    checkEligibility,
    submitWithdrawal,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'pending'),
    approvedWithdrawals: withdrawals.filter(w => w.status === 'approved'),
    rejectedWithdrawals: withdrawals.filter(w => w.status === 'rejected'),
  };
}
