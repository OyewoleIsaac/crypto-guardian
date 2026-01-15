import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Search,
  RefreshCw,
  User,
  DollarSign,
  Plus,
  Minus,
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
import { createNotification, logAuditEvent } from '@/hooks/useNotifications';

interface UserWithInvestment {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  investment?: {
    balance: number;
    currency: string;
    plan: string;
  };
}

const planIcons: Record<string, any> = {
  silver: Medal,
  gold: Crown,
  diamond: Diamond,
};

const planColors: Record<string, string> = {
  silver: 'bg-slate-500/10 text-slate-600 border-slate-300',
  gold: 'bg-amber-500/10 text-amber-600 border-amber-400',
  diamond: 'bg-cyan-500/10 text-cyan-600 border-cyan-400',
};

export function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithInvestment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithInvestment | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustReason, setAdjustReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: investments, error: investmentsError } = await supabase
        .from('investments')
        .select('*');

      if (investmentsError) throw investmentsError;

      const combinedUsers = profiles?.map((profile) => {
        const investment = investments?.find((inv) => inv.user_id === profile.user_id);
        return {
          ...profile,
          investment: investment ? {
            balance: Number(investment.balance),
            currency: investment.currency,
            plan: investment.plan || 'silver',
          } : undefined,
        };
      }) || [];

      setUsers(combinedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser || !user || !adjustAmount) return;
    
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setProcessing(true);
    try {
      const currentBalance = selectedUser.investment?.balance || 0;
      const newBalance = adjustType === 'add' 
        ? currentBalance + amount 
        : Math.max(0, currentBalance - amount);

      const { error: updateError } = await supabase
        .from('investments')
        .update({ balance: newBalance })
        .eq('user_id', selectedUser.user_id);

      if (updateError) throw updateError;

      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: selectedUser.user_id,
          type: adjustType === 'add' ? 'credit' : 'debit',
          amount: adjustType === 'add' ? amount : -amount,
          description: adjustReason || `Admin ${adjustType === 'add' ? 'credit' : 'debit'} adjustment`,
          performed_by: user.id,
        });

      if (txError) throw txError;

      // Create notification for user (admin has permission via RLS)
      await createNotification(
        selectedUser.user_id,
        adjustType === 'add' ? 'Balance Credited' : 'Balance Debited',
        `Your account has been ${adjustType === 'add' ? 'credited' : 'debited'} with $${amount.toFixed(2)}. ${adjustReason ? `Reason: ${adjustReason}` : ''}`,
        'balance'
      );

      // Log audit event (admin has permission via RLS)
      await logAuditEvent(
        selectedUser.user_id,
        'balance_adjustment',
        {
          type: adjustType,
          amount,
          reason: adjustReason,
          previous_balance: currentBalance,
          new_balance: newBalance,
        },
        user.id
      );

      toast.success(`Balance ${adjustType === 'add' ? 'increased' : 'decreased'} successfully`);
      setAdjustDialogOpen(false);
      setSelectedUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      fetchUsers();
    } catch (error) {
      console.error('Error adjusting balance:', error);
      toast.error('Failed to adjust balance');
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      u.email?.toLowerCase().includes(searchLower) ||
      u.full_name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-xl font-semibold text-foreground">
          User Management ({filteredUsers.length})
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Plan</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Balance</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const userPlan = u.investment?.plan || 'silver';
                const PlanIcon = planIcons[userPlan] || Medal;
                
                return (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                          {u.full_name?.charAt(0) || u.email?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium text-foreground">
                          {u.full_name || 'No name'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {u.email || 'No email'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${planColors[userPlan]}`}>
                        <PlanIcon className="h-3.5 w-3.5" />
                        {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-foreground">
                        ${u.investment?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setSelectedUser(u);
                          setAdjustDialogOpen(true);
                        }}
                      >
                        <DollarSign className="h-4 w-4" />
                        Adjust
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust User Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-muted border border-border">
              <p className="text-sm text-muted-foreground">User</p>
              <p className="font-medium text-foreground">{selectedUser?.full_name || selectedUser?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm text-muted-foreground">Plan:</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${planColors[selectedUser?.investment?.plan || 'silver']}`}>
                  {(selectedUser?.investment?.plan || 'silver').charAt(0).toUpperCase() + (selectedUser?.investment?.plan || 'silver').slice(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Current Balance</p>
              <p className="font-semibold text-xl text-foreground">
                ${selectedUser?.investment?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={adjustType === 'add' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setAdjustType('add')}
              >
                <Plus className="h-4 w-4" />
                Add Funds
              </Button>
              <Button
                variant={adjustType === 'subtract' ? 'destructive' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setAdjustType('subtract')}
              >
                <Minus className="h-4 w-4" />
                Subtract
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Explain the reason for this adjustment..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant={adjustType === 'add' ? 'default' : 'destructive'} 
              onClick={handleAdjustBalance} 
              disabled={processing || !adjustAmount}
            >
              {processing ? 'Processing...' : `${adjustType === 'add' ? 'Add' : 'Subtract'} $${adjustAmount || '0'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}