import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
  referred_user?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface ReferralStats {
  referralCode: string | null;
  referralLink: string;
  totalReferrals: number;
  referrals: Referral[];
}

export function useReferrals() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats>({
    referralCode: null,
    referralLink: '',
    totalReferrals: 0,
    referrals: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchReferralData = useCallback(async () => {
    if (!user) return;

    try {
      // Get user's referral code from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get referrals made by this user
      const { data: referrals, error: referralsError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      // Get referred user details
      const referralsWithUsers: Referral[] = [];
      for (const ref of referrals || []) {
        const { data: referredProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', ref.referred_id)
          .single();

        referralsWithUsers.push({
          ...ref,
          referred_user: referredProfile || undefined,
        });
      }

      const referralCode = profile?.referral_code || null;
      const baseUrl = window.location.origin;

      setStats({
        referralCode,
        referralLink: referralCode ? `${baseUrl}/auth?mode=signup&ref=${referralCode}` : '',
        totalReferrals: referralsWithUsers.length,
        referrals: referralsWithUsers,
      });
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  return {
    ...stats,
    isLoading,
    refetch: fetchReferralData,
  };
}

// Validate and process referral code during signup
export async function processReferralCode(
  referralCode: string,
  newUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find referrer by code
    const { data: referrer, error: findError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (findError || !referrer) {
      return { success: false, error: 'Invalid referral code' };
    }

    // Prevent self-referral
    if (referrer.user_id === newUserId) {
      return { success: false, error: 'You cannot refer yourself' };
    }

    // Create referral record
    const { error: insertError } = await supabase
      .from('referrals')
      .insert([{
        referrer_id: referrer.user_id,
        referred_id: newUserId,
      }]);

    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: 'You have already been referred' };
      }
      throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing referral:', error);
    return { success: false, error: 'Failed to process referral' };
  }
}

// Admin hook to get all referral data
export function useAdminReferrals() {
  const { isAdmin } = useAuth();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllReferrals = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with user details
      const enrichedReferrals = [];
      for (const ref of data || []) {
        const [referrerProfile, referredProfile] = await Promise.all([
          supabase.from('profiles').select('full_name, email').eq('user_id', ref.referrer_id).single(),
          supabase.from('profiles').select('full_name, email').eq('user_id', ref.referred_id).single(),
        ]);

        enrichedReferrals.push({
          ...ref,
          referrer: referrerProfile.data,
          referred: referredProfile.data,
        });
      }

      setReferrals(enrichedReferrals);
    } catch (error) {
      console.error('Error fetching all referrals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchAllReferrals();
  }, [fetchAllReferrals]);

  return {
    referrals,
    isLoading,
    refetch: fetchAllReferrals,
  };
}
