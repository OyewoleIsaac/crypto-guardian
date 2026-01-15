import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  ArrowDownToLine,
  User,
  Calendar,
  DollarSign,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  wallet_address: string;
  crypto_type: string;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export function WithdrawalManagement() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for each withdrawal
      const withdrawalsWithUsers = await Promise.all(
        (data || []).map(async (withdrawal) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', withdrawal.user_id)
            .maybeSingle();

          return {
            ...withdrawal,
            user_email: profile?.email || 'N/A',
            user_name: profile?.full_name || 'Unknown User',
          };
        })
      );

      setWithdrawals(withdrawalsWithUsers);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleProcessWithdrawal = async (action: 'approved' | 'rejected') => {
    if (!selectedWithdrawal || !user) return;

    setIsProcessing(true);
    try {
      // Update withdrawal status
      const { error: updateError } = await supabase
        .from('withdrawals')
        .update({
          status: action,
          admin_notes: adminNotes || null,
          processed_by: user.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedWithdrawal.id);

      if (updateError) throw updateError;

      // If approved, deduct from user balance
      if (action === 'approved') {
        const { data: investment, error: fetchError } = await supabase
          .from('investments')
          .select('balance')
          .eq('user_id', selectedWithdrawal.user_id)
          .single();

        if (fetchError) throw fetchError;

        const newBalance = (investment?.balance || 0) - selectedWithdrawal.amount;
        
        const { error: balanceError } = await supabase
          .from('investments')
          .update({ balance: Math.max(0, newBalance) })
          .eq('user_id', selectedWithdrawal.user_id);

        if (balanceError) throw balanceError;

        // Record transaction
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            user_id: selectedWithdrawal.user_id,
            type: 'withdrawal',
            amount: -selectedWithdrawal.amount,
            description: `Withdrawal to ${selectedWithdrawal.wallet_address}`,
            performed_by: user.id,
          });

        if (txError) throw txError;
      }

      // Notification and audit log are now handled by database triggers
      // (on_withdrawal_status_change and on_withdrawal_audit)

      toast.success(`Withdrawal ${action} successfully`);
      setSelectedWithdrawal(null);
      setAdminNotes('');
      fetchWithdrawals();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('Failed to process withdrawal');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesSearch = 
      w.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.wallet_address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const totalPendingAmount = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground">{pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Amount</p>
              <p className="text-xl font-bold text-foreground">${totalPendingAmount.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Withdrawals</p>
              <p className="text-xl font-bold text-foreground">{withdrawals.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or wallet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchWithdrawals}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Withdrawals List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredWithdrawals.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No withdrawal requests found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWithdrawals.map((withdrawal) => (
            <Card
              key={withdrawal.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                if (withdrawal.status === 'pending') {
                  setSelectedWithdrawal(withdrawal);
                  setAdminNotes(withdrawal.admin_notes || '');
                }
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ArrowDownToLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      ${withdrawal.amount.toFixed(2)} {withdrawal.crypto_type}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{withdrawal.user_name}</span>
                      <span className="text-muted-foreground/50">|</span>
                      <span>{withdrawal.user_email}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-1">
                      <Wallet className="h-3 w-3 inline mr-1" />
                      {withdrawal.wallet_address}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {getStatusBadge(withdrawal.status)}
                    <p className="text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {format(new Date(withdrawal.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  {withdrawal.status === 'pending' && (
                    <Button size="sm" variant="outline">
                      Review
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Process Withdrawal Dialog */}
      <Dialog open={!!selectedWithdrawal} onOpenChange={() => setSelectedWithdrawal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Withdrawal Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this withdrawal request.
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-medium text-foreground">{selectedWithdrawal.user_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedWithdrawal.user_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-bold text-foreground text-lg">
                    ${selectedWithdrawal.amount.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedWithdrawal.crypto_type}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Wallet Address</p>
                <p className="font-mono text-sm bg-muted p-2 rounded break-all">
                  {selectedWithdrawal.wallet_address}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Admin Notes (optional)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this withdrawal..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={() => handleProcessWithdrawal('rejected')}
              disabled={isProcessing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              variant="default"
              onClick={() => handleProcessWithdrawal('approved')}
              disabled={isProcessing}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
