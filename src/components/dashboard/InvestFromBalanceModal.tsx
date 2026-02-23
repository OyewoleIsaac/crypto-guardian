import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Wallet, Calculator, AlertCircle } from 'lucide-react';
import { InvestmentPlan } from '@/hooks/useInvestmentPlans';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface InvestFromBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: InvestmentPlan | null;
  currentBalance: number;
  onSuccess: () => void;
}

export function InvestFromBalanceModal({
  open,
  onOpenChange,
  plan,
  currentBalance,
  onSuccess,
}: InvestFromBalanceModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!plan) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const isValidAmount = parsedAmount >= plan.min_investment && 
    parsedAmount <= currentBalance &&
    (!plan.max_investment || parsedAmount <= plan.max_investment);
  
  const expectedRoi = (parsedAmount * plan.roi_percentage) / 100;
  const dailyRoi = expectedRoi / plan.duration_days;

  const handleInvest = async () => {
    if (!user || !isValidAmount) return;

    setIsLoading(true);
    try {
      // 1. Deduct from user balance
      const newBalance = currentBalance - parsedAmount;
      
      const { error: balanceError } = await supabase
        .from('investments')
        .update({ balance: newBalance, plan: plan.name.toLowerCase() })
        .eq('user_id', user.id);

      if (balanceError) throw balanceError;

      // 2. Create active investment
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration_days);

      const { error: investmentError } = await supabase
        .from('active_investments')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          principal_amount: parsedAmount,
          daily_roi: dailyRoi,
          total_roi_earned: 0,
          claimed_roi: 0,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
        });

      if (investmentError) throw investmentError;

      // 3. Record transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'investment',
          amount: -parsedAmount,
          description: `Investment activated - ${plan.name} Plan`,
        });

      if (txError) throw txError;

      // 4. Create notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Investment Activated',
          message: `Your ${plan.name} Plan has been activated with $${parsedAmount.toFixed(2)}. Daily ROI: $${dailyRoi.toFixed(2)}. Duration: ${plan.duration_days} days.`,
          type: 'investment',
        });

      if (notifError) console.warn('Notification insert failed:', notifError);

      toast.success(`${plan.name} Plan activated with $${parsedAmount.toLocaleString()}!`);
      onOpenChange(false);
      setAmount('');
      onSuccess();
    } catch (error) {
      console.error('Investment error:', error);
      toast.error('Failed to activate investment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="font-display text-xl">Invest in {plan.name} Plan</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Use your available balance to start investing
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Balance Info */}
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <span className="font-semibold text-foreground">${currentBalance.toLocaleString()}</span>
            </div>
          </div>

          {/* Plan Details */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ROI</span>
              <span className="font-medium text-primary">{plan.roi_percentage}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{plan.duration_days} days</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Min Investment</span>
              <span className="font-medium">${plan.min_investment.toLocaleString()}</span>
            </div>
            {plan.max_investment && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Max Investment</span>
                <span className="font-medium">${plan.max_investment.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="invest-amount">Investment Amount (USD)</Label>
            <Input
              id="invest-amount"
              type="number"
              placeholder={`Min $${plan.min_investment.toLocaleString()}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 text-lg"
            />
            {parsedAmount > 0 && parsedAmount < plan.min_investment && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Minimum investment is ${plan.min_investment.toLocaleString()}
              </p>
            )}
            {parsedAmount > currentBalance && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Amount exceeds your available balance
              </p>
            )}
            {plan.max_investment && parsedAmount > plan.max_investment && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Maximum investment is ${plan.max_investment.toLocaleString()}
              </p>
            )}
          </div>

          {/* Projected Returns */}
          {parsedAmount >= plan.min_investment && parsedAmount <= currentBalance && (
            <div className="rounded-xl bg-success/10 border border-success/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-5 w-5 text-success" />
                <span className="font-medium text-success">Projected Returns</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Daily ROI</p>
                  <p className="font-semibold text-foreground">${dailyRoi.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total ROI</p>
                  <p className="font-semibold text-success">${expectedRoi.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Return</p>
                  <p className="font-semibold text-foreground">${(parsedAmount + expectedRoi).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold text-foreground">{plan.duration_days} days</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleInvest} 
            disabled={!isValidAmount || isLoading}
            className="flex-1 gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            {isLoading ? 'Processing...' : 'Invest Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
