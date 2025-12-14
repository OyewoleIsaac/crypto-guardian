import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActiveInvestment {
  id: string;
  user_id: string;
  plan_id: string;
  principal_amount: number;
  total_roi_earned: number;
  claimed_roi: number;
  daily_roi: number;
  start_date: string;
  end_date: string;
  status: string;
  deposit_id: string | null;
  plan?: {
    name: string;
    roi_percentage: number;
    duration_days: number;
  };
}

export function useActiveInvestments() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvestments = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('active_investments')
        .select(`
          *,
          plan:investment_plans(name, roi_percentage, duration_days)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setInvestments(data || []);
    } catch (err) {
      console.error('Error fetching active investments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch investments');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  // Calculate claimable ROI for each investment
  const getClaimableRoi = useCallback((investment: ActiveInvestment): number => {
    const now = new Date();
    const startDate = new Date(investment.start_date);
    const endDate = new Date(investment.end_date);
    
    // If investment hasn't started or is completed
    if (now < startDate) return 0;
    
    // Calculate days elapsed
    const effectiveEndDate = now < endDate ? now : endDate;
    const daysElapsed = Math.floor((effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Total earned = daily_roi * days elapsed
    const totalEarned = investment.daily_roi * daysElapsed;
    
    // Claimable = total earned - already claimed
    return Math.max(0, totalEarned - investment.claimed_roi);
  }, []);

  // Check if investment can be withdrawn (principal)
  const canWithdraw = useCallback((investment: ActiveInvestment): boolean => {
    const now = new Date();
    const endDate = new Date(investment.end_date);
    return now >= endDate && investment.status === 'active';
  }, []);

  // Get days remaining
  const getDaysRemaining = useCallback((investment: ActiveInvestment): number => {
    const now = new Date();
    const endDate = new Date(investment.end_date);
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, []);

  return {
    investments,
    activeInvestments: investments.filter(i => i.status === 'active'),
    completedInvestments: investments.filter(i => i.status === 'completed'),
    isLoading,
    error,
    refetch: fetchInvestments,
    getClaimableRoi,
    canWithdraw,
    getDaysRemaining,
  };
}