import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InvestmentPlan {
  id: string;
  name: string;
  description: string | null;
  min_investment: number;
  max_investment: number | null;
  roi_percentage: number;
  duration_days: number;
  features: string[];
  is_active: boolean;
  icon_name: string;
  color_class: string;
  display_order: number;
}

export function useInvestmentPlans() {
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('investment_plans')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;
      
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch plans');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    isLoading,
    error,
    refetch: fetchPlans,
  };
}