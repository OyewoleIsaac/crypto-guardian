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
  Clock
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
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export function PendingDeposits() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDeposits();
  }, []);

  const fetchDeposits = async () => {
    setIsLoading(true);
    try {
      // Fetch deposits
      const { data: depositsData, error: depositsError } = await supabase
        .from('deposits')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (depositsError) throw depositsError;

      // Fetch profiles for each deposit
      const userIds = [...new Set(depositsData?.map(d => d.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Combine data
      const combinedDeposits = depositsData?.map(deposit => ({
        ...deposit,
        profiles: profilesData?.find(p => p.user_id === deposit.user_id) || null
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
      // Update deposit status
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

      // Update user's investment balance
      const { data: currentInvestment, error: fetchError } = await supabase
        .from('investments')
        .select('balance')
        .eq('user_id', selectedDeposit.user_id)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = Number(currentInvestment.balance) + Number(selectedDeposit.amount);

      const { error: updateError } = await supabase
        .from('investments')
        .update({ balance: newBalance })
        .eq('user_id', selectedDeposit.user_id);

      if (updateError) throw updateError;

      // Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: selectedDeposit.user_id,
          type: 'deposit',
          amount: selectedDeposit.amount,
          description: `Deposit confirmed - ${selectedDeposit.crypto_type}`,
          performed_by: user.id,
        });

      if (txError) throw txError;

      toast.success('Deposit confirmed successfully');
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
          Pending Deposits
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
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredDeposits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No pending deposits</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeposits.map((deposit) => (
            <div
              key={deposit.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-muted/50 gap-4"
            >
              <div className="flex items-center gap-4">
                <div className={`crypto-icon ${
                  deposit.crypto_type === 'BTC' ? 'crypto-btc' :
                  deposit.crypto_type === 'USDT' ? 'crypto-usdt' : 'crypto-ada'
                }`}>
                  {deposit.crypto_type.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    ${deposit.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {deposit.crypto_amount} {deposit.crypto_type} • {deposit.profiles?.email || 'Unknown user'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(deposit.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-success/10 border border-success/20">
              <p className="font-semibold text-success">
                ${selectedDeposit?.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedDeposit?.crypto_amount} {selectedDeposit?.crypto_type}
              </p>
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
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="font-semibold text-destructive">
                ${selectedDeposit?.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
