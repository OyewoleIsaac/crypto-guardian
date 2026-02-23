import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  Clock, 
  Lock, 
  Gift,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { ActiveInvestment } from '@/hooks/useActiveInvestments';

interface ActiveInvestmentCardProps {
  investment: ActiveInvestment;
  claimableRoi: number;
  daysRemaining: number;
  canWithdraw: boolean;
  onUpdate: () => void;
}

export function ActiveInvestmentCard({
  investment,
  claimableRoi,
  daysRemaining,
  canWithdraw,
  onUpdate,
}: ActiveInvestmentCardProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const totalDuration = investment.plan?.duration_days || 30;
  const daysElapsed = totalDuration - daysRemaining;
  const progress = Math.min(100, (daysElapsed / totalDuration) * 100);

  const totalExpectedRoi = investment.principal_amount * ((investment.plan?.roi_percentage || 0) / 100);

  const handleClaimRoi = async () => {
    if (claimableRoi <= 0) {
      toast.info('No ROI available to claim yet');
      return;
    }

    setIsClaiming(true);
    try {
      // Update claimed_roi in active_investments
      const newClaimedRoi = investment.claimed_roi + claimableRoi;
      
      const { error: updateError } = await supabase
        .from('active_investments')
        .update({ 
          claimed_roi: newClaimedRoi,
          total_roi_earned: newClaimedRoi
        })
        .eq('id', investment.id);

      if (updateError) throw updateError;

      // Add to user's balance
      const { data: currentInvestment, error: fetchError } = await supabase
        .from('investments')
        .select('balance')
        .eq('user_id', investment.user_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const baseBalance = Number(currentInvestment?.balance || 0);
      const newBalance = baseBalance + claimableRoi;

      if (currentInvestment) {
        const { error: balanceError } = await supabase
          .from('investments')
          .update({ balance: newBalance })
          .eq('user_id', investment.user_id);

        if (balanceError) throw balanceError;
      } else {
        const { error: insertError } = await supabase
          .from('investments')
          .insert({
            user_id: investment.user_id,
            balance: newBalance,
          });

        if (insertError) throw insertError;
      }

      // Record transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: investment.user_id,
          type: 'roi_claim',
          amount: claimableRoi,
          description: `ROI claimed from ${investment.plan?.name || 'investment'}`,
        });

      if (txError) throw txError;

      toast.success(`Successfully claimed $${claimableRoi.toFixed(2)} ROI`);
      onUpdate();
    } catch (error) {
      console.error('Error claiming ROI:', error);
      toast.error('Failed to claim ROI');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleWithdraw = async () => {
    if (!canWithdraw || isWithdrawing) return;

    setIsWithdrawing(true);
    try {
      // Calculate remaining ROI similar to getClaimableRoi
      const now = new Date();
      const startDate = new Date(investment.start_date);
      const endDate = new Date(investment.end_date);

      if (now < startDate) {
        toast.info('Investment has not started yet');
        return;
      }

      const effectiveEndDate = now < endDate ? now : endDate;
      const daysElapsed = Math.floor(
        (effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const totalEarned = investment.daily_roi * daysElapsed;
      const remainingRoi = Math.max(0, totalEarned - investment.claimed_roi);
      const totalAmount = investment.principal_amount + remainingRoi;

      // Mark investment as completed and update claimed ROI
      const { error: updateError } = await supabase
        .from('active_investments')
        .update({
          status: 'completed',
          claimed_roi: investment.claimed_roi + remainingRoi,
        })
        .eq('id', investment.id);

      if (updateError) throw updateError;

      // Add principal + remaining ROI back to user balance
      const { data: currentInvestment, error: fetchError } = await supabase
        .from('investments')
        .select('balance')
        .eq('user_id', investment.user_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const baseBalance = Number(currentInvestment?.balance || 0);
      const newBalance = baseBalance + totalAmount;

      if (currentInvestment) {
        const { error: balanceError } = await supabase
          .from('investments')
          .update({ balance: newBalance })
          .eq('user_id', investment.user_id);

        if (balanceError) throw balanceError;
      } else {
        const { error: insertError } = await supabase
          .from('investments')
          .insert({
            user_id: investment.user_id,
            balance: newBalance,
          });

        if (insertError) throw insertError;
      }

      // Record transaction (type investment_completed so History shows "Investment Completed" / "Principal and ROI claimed")
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: investment.user_id,
          type: 'investment_completed',
          amount: totalAmount,
          description: 'Principal and ROI claimed',
        });

      if (txError) throw txError;

      toast.success(`Reward claimed: $${totalAmount.toFixed(2)} added to your balance`);
      onUpdate();
    } catch (error) {
      console.error('Error withdrawing investment:', error);
      toast.error('Failed to claim reward');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {investment.plan?.name || 'Investment'} Plan
          </h3>
          <p className="text-sm text-muted-foreground">
            Started {new Date(investment.start_date).toLocaleDateString()}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          investment.status === 'active' 
            ? 'bg-success/10 text-success' 
            : investment.status === 'completed'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        }`}>
          {investment.status.charAt(0).toUpperCase() + investment.status.slice(1)}
        </div>
      </div>

      {/* Investment Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Principal</p>
          <p className="text-lg font-bold text-foreground">
            ${investment.principal_amount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Expected ROI</p>
          <p className="text-lg font-bold text-success">
            ${totalExpectedRoi.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">
            {daysElapsed} / {totalDuration} days
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* ROI Info */}
      <div className="rounded-xl bg-gradient-to-r from-success/10 to-primary/10 border border-success/20 p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Claimable ROI</p>
              <p className="text-xl font-bold text-success">
                ${claimableRoi.toFixed(2)}
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={handleClaimRoi}
            disabled={isClaiming || claimableRoi <= 0}
            className="gap-2"
          >
            {isClaiming ? 'Claiming...' : 'Claim ROI'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Daily ROI: ${investment.daily_roi.toFixed(2)} | Claimed: ${investment.claimed_roi.toFixed(2)}
        </p>
      </div>

      {/* Withdrawal Notice */}
      {!canWithdraw && (
        <div className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/20 p-4">
          <Lock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-warning">Principal Locked</p>
            <p className="text-xs text-muted-foreground">
              Withdrawals will be available after the investment period ends ({daysRemaining} days remaining).
            </p>
          </div>
        </div>
      )}

      {canWithdraw && (
        <div className="flex items-start gap-3 rounded-xl bg-success/10 border border-success/20 p-4">
          <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-success">Investment Complete</p>
            <p className="text-xs text-muted-foreground">
              Your principal of ${investment.principal_amount.toLocaleString()} and any remaining ROI are ready to be claimed.
            </p>
            <div className="mt-3">
              <Button
                size="sm"
                className="gap-2"
                onClick={handleWithdraw}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? 'Processing...' : 'Claim Reward'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}