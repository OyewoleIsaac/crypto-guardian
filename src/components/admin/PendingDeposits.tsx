import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Search,
  Clock,
  Image,
  ExternalLink,
  Crown,
  Diamond,
  Medal
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createNotification } from '@/hooks/useNotifications';

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  crypto_type: string;
  crypto_amount: number;
  wallet_address: string;
  tx_hash: string | null;
  status: string;
  created_at: string;
  proof_image_url: string | null;
  plan_id: string | null;
  usd_amount: number | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
  investments?: {
    plan: string;
  };
  investment_plan?: {
    id: string;
    name: string;
    roi_percentage: number;
    duration_days: number;
  };
}

const planIcons: Record<string, any> = {
  silver: Medal,
  gold: Crown,
  diamond: Diamond,
};

export function PendingDeposits() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    setIsLoading(true);
    try {
      const { data: depositsData, error: depositsError } = await supabase
        .from('deposits')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (depositsError) throw depositsError;

      const userIds = [...new Set(depositsData?.map(d => d.user_id) || [])];
      const planIds = [...new Set(depositsData?.filter(d => d.plan_id).map(d => d.plan_id) || [])];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const { data: investmentsData } = await supabase
        .from('investments')
        .select('user_id, plan')
        .in('user_id', userIds);

      let plansData: any[] = [];
      if (planIds.length > 0) {
        const { data } = await supabase
          .from('investment_plans')
          .select('id, name, roi_percentage, duration_days')
          .in('id', planIds);
        plansData = data || [];
      }

      const combinedDeposits = depositsData?.map(deposit => ({
        ...deposit,
        profiles: profilesData?.find(p => p.user_id === deposit.user_id) || null,
        investments: investmentsData?.find(i => i.user_id === deposit.user_id) || null,
        investment_plan: plansData?.find(p => p.id === deposit.plan_id) || null
      })) || [];

      setDeposits(combinedDeposits);
    } catch (error) {
      console.error('Error fetching deposits:', error);
      toast.error('Failed to load deposits');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDeposit || !user) return;
    
    setProcessing(true);
    try {
      // 1. Update deposit status
      const { error: depositError } = await supabase
        .from('deposits')
        .update({
          status: 'confirmed',
          tx_hash: txHash || null,
          admin_notes: adminNotes || null,
          confirmed_by: user.id,
        })
        .eq('id', selectedDeposit.id);

      if (depositError) throw depositError;

      // 2. Update user balance
      const { data: currentInvestment, error: fetchError } = await supabase
        .from('investments')
        .select('balance')
        .eq('user_id', selectedDeposit.user_id)
        .single();

      if (fetchError) throw fetchError;

      const depositAmount = selectedDeposit.usd_amount || selectedDeposit.amount;
      const newBalance = Number(currentInvestment.balance) + Number(depositAmount);

      const { error: updateError } = await supabase
        .from('investments')
        .update({ balance: newBalance })
        .eq('user_id', selectedDeposit.user_id);

      if (updateError) throw updateError;

      // 3. Record transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: selectedDeposit.user_id,
          type: 'deposit',
          amount: depositAmount,
          description: `Deposit confirmed - ${selectedDeposit.crypto_type}`,
          performed_by: user.id,
        });

      if (txError) throw txError;

      // 4. If deposit has a plan_id, create active investment
      if (selectedDeposit.plan_id && selectedDeposit.investment_plan) {
        const plan = selectedDeposit.investment_plan;
        const principalAmount = depositAmount;
        
        // Calculate daily ROI
        const totalRoi = (principalAmount * plan.roi_percentage) / 100;
        const dailyRoi = totalRoi / plan.duration_days;
        
        // Calculate end date
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration_days);

        const { error: investmentError } = await supabase
          .from('active_investments')
          .insert({
            user_id: selectedDeposit.user_id,
            plan_id: selectedDeposit.plan_id,
            deposit_id: selectedDeposit.id,
            principal_amount: principalAmount,
            daily_roi: dailyRoi,
            total_roi_earned: 0,
            claimed_roi: 0,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            status: 'active',
          });

        if (investmentError) throw investmentError;

        // Deduct the principal from the balance (it's now in the investment)
        const { error: deductError } = await supabase
          .from('investments')
          .update({ balance: newBalance - principalAmount })
          .eq('user_id', selectedDeposit.user_id);

        if (deductError) throw deductError;

        // Record investment transaction
        const { error: investTxError } = await supabase
          .from('transactions')
          .insert({
            user_id: selectedDeposit.user_id,
            type: 'investment',
            amount: -principalAmount,
            description: `Investment activated - ${plan.name} Plan`,
            performed_by: user.id,
          });

        if (investTxError) throw investTxError;

        // Create investment notification via admin insert (RLS allows admins)
        await createNotification(
          selectedDeposit.user_id,
          'Investment Activated',
          `Your ${plan.name} Plan has been activated with $${principalAmount.toFixed(2)}. Daily ROI: $${dailyRoi.toFixed(2)}. Duration: ${plan.duration_days} days.`,
          'investment'
        );

        toast.success(`Deposit confirmed and ${plan.name} Plan activated!`);
      } else {
        // Deposit notification is now handled by database trigger (on_deposit_status_change)
        toast.success('Deposit confirmed successfully');
      }

      // Audit log is now handled by database trigger (on_deposit_audit)

      setConfirmDialogOpen(false);
      setSelectedDeposit(null);
      setTxHash('');
      setAdminNotes('');
      fetchDeposits();
    } catch (error) {
      console.error('Error confirming deposit:', error);
      toast.error('Failed to confirm deposit');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDeposit || !user) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('deposits')
        .update({
          status: 'rejected',
          admin_notes: adminNotes || 'Deposit rejected by admin',
          confirmed_by: user.id,
        })
        .eq('id', selectedDeposit.id);

      if (error) throw error;

      // Notification and audit log are now handled by database triggers
      // (on_deposit_status_change and on_deposit_audit)

      toast.success('Deposit rejected');
      setRejectDialogOpen(false);
      setSelectedDeposit(null);
      setAdminNotes('');
      fetchDeposits();
    } catch (error) {
      console.error('Error rejecting deposit:', error);
      toast.error('Failed to reject deposit');
    } finally {
      setProcessing(false);
    }
  };

  const filteredDeposits = deposits.filter((d) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      d.crypto_type.toLowerCase().includes(searchLower) ||
      d.wallet_address.toLowerCase().includes(searchLower) ||
      (d.profiles?.email?.toLowerCase().includes(searchLower)) ||
      (d.profiles?.full_name?.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Pending Deposits ({filteredDeposits.length})
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={fetchDeposits}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredDeposits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending deposits</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeposits.map((deposit) => {
            const userPlan = deposit.investments?.plan || 'silver';
            const PlanIcon = planIcons[userPlan] || Medal;
            
            return (
              <div
                key={deposit.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-xl bg-muted/50 border border-border gap-4"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`crypto-icon ${
                    deposit.crypto_type === 'BTC' ? 'crypto-btc' :
                    deposit.crypto_type === 'USDT' ? 'crypto-usdt' : 
                    deposit.crypto_type === 'ETH' ? 'crypto-eth' : 'crypto-ada'
                  }`}>
                    {deposit.crypto_type.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">
                        ${(deposit.usd_amount || deposit.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        userPlan === 'diamond' ? 'bg-cyan-500/10 text-cyan-600' :
                        userPlan === 'gold' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-slate-500/10 text-slate-600'
                      }`}>
                        <PlanIcon className="h-3 w-3" />
                        {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                      </span>
                      {deposit.investment_plan && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          → {deposit.investment_plan.name} Plan
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {deposit.crypto_amount} {deposit.crypto_type} • {deposit.profiles?.email || 'Unknown user'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(deposit.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {deposit.proof_image_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setSelectedDeposit(deposit);
                        setImageDialogOpen(true);
                      }}
                    >
                      <Image className="h-4 w-4" />
                      View Proof
                    </Button>
                  )}
                  <Button
                    variant="success"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setSelectedDeposit(deposit);
                      setConfirmDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Confirm
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setSelectedDeposit(deposit);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Proof</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedDeposit?.proof_image_url && (
              <div className="space-y-4">
                <img 
                  src={selectedDeposit.proof_image_url} 
                  alt="Transaction proof" 
                  className="w-full rounded-xl border border-border"
                />
                <a 
                  href={selectedDeposit.proof_image_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-success/10 border border-success/20">
              <p className="font-semibold text-success text-lg">
                ${(selectedDeposit?.usd_amount || selectedDeposit?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedDeposit?.crypto_amount} {selectedDeposit?.crypto_type}
              </p>
              {selectedDeposit?.investment_plan && (
                <p className="text-sm text-primary mt-2 font-medium">
                  Will activate: {selectedDeposit.investment_plan.name} Plan ({selectedDeposit.investment_plan.roi_percentage}% ROI over {selectedDeposit.investment_plan.duration_days} days)
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="txHash">Transaction Hash (optional)</Label>
              <Input
                id="txHash"
                placeholder="0x..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Admin Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleConfirm} disabled={processing}>
              {processing ? 'Processing...' : 'Confirm Deposit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="font-semibold text-destructive text-lg">
                ${(selectedDeposit?.usd_amount || selectedDeposit?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedDeposit?.crypto_amount} {selectedDeposit?.crypto_type}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="rejectNotes">Reason for rejection</Label>
              <Textarea
                id="rejectNotes"
                placeholder="Explain why this deposit is being rejected..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? 'Processing...' : 'Reject Deposit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
