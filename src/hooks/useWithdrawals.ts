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

  // Check withdrawal eligibility based on 30-day rule
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

    // Get user balance
    const { data: investment, error: balanceError } = await supabase
      .from('investments')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    if (balanceError) {
      console.error('Error fetching balance:', balanceError);
    }

    const availableBalance = investment?.balance || 0;

    // Check if user has any investments
    if (activeInvestments.length === 0) {
      // Check if there are any completed investments
      const { data: completedInvestments, error: completedError } = await supabase
        .from('active_investments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (completedError) {
        console.error('Error checking completed investments:', completedError);
      }

      if (!completedInvestments || completedInvestments.length === 0) {
        return {
          canWithdraw: false,
          reason: 'No balance available for withdrawal. Please make an investment first.',
          availableBalance,
          daysUntilEligible: null,
          hasActiveInvestment: false,
        };
      }
    }

    // Check 30-day rule from earliest active investment
    const earliestInvestment = activeInvestments.reduce((earliest, inv) => {
      const invStart = new Date(inv.start_date);
      const earliestStart = earliest ? new Date(earliest.start_date) : null;
      return !earliestStart || invStart < earliestStart ? inv : earliest;
    }, activeInvestments[0]);

    if (earliestInvestment) {
      const startDate = new Date(earliestInvestment.start_date);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart < 30) {
        const daysUntilEligible = 30 - daysSinceStart;
        return {
          canWithdraw: false,
          reason: `Withdrawals are only available after 30 days. ${daysUntilEligible} day${daysUntilEligible !== 1 ? 's' : ''} remaining.`,
          availableBalance,
          daysUntilEligible,
          hasActiveInvestment: true,
        };
      }
    }

    // Check if balance is positive
    if (availableBalance <= 0) {
      return {
        canWithdraw: false,
        reason: 'No balance available for withdrawal.',
        availableBalance,
        daysUntilEligible: null,
        hasActiveInvestment: activeInvestments.length > 0,
      };
    }

    // Check for pending withdrawals
    const hasPendingWithdrawal = withdrawals.some(w => w.status === 'pending');
    if (hasPendingWithdrawal) {
      return {
        canWithdraw: false,
        reason: 'You already have a pending withdrawal request. Please wait for it to be processed.',
        availableBalance,
        daysUntilEligible: null,
        hasActiveInvestment: activeInvestments.length > 0,
      };
    }

    return {
      canWithdraw: true,
      reason: 'You are eligible to withdraw.',
      availableBalance,
      daysUntilEligible: null,
      hasActiveInvestment: activeInvestments.length > 0,
    };
  }, [user, activeInvestments, withdrawals]);

  // Submit withdrawal request
  const submitWithdrawal = async (amount: number, walletAddress: string, cryptoType: string = 'USDT') => {
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

    const { data, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount,
        wallet_address: walletAddress,
        crypto_type: cryptoType,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Create notification for user
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal request for $${amount.toFixed(2)} has been submitted and is pending approval.`,
      type: 'info',
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'withdrawal_request',
      details: { amount, wallet_address: walletAddress, crypto_type: cryptoType },
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
