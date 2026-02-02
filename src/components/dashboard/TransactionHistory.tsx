import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  RefreshCw,
  Filter,
  Briefcase,
  Gift,
  Wallet,
  CreditCard,
  ArrowDownToLine,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HistoryEvent {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  status?: string;
  source?: 'transaction' | 'deposit' | 'withdrawal' | 'investment';
}

const eventTypeConfig: Record<string, { icon: any; label: string; colorClass: string }> = {
  deposit: { icon: ArrowUpRight, label: 'Deposit', colorClass: 'text-success bg-success/10' },
  credit: { icon: ArrowUpRight, label: 'Credit', colorClass: 'text-success bg-success/10' },
  roi_claim: { icon: Gift, label: 'ROI Claimed', colorClass: 'text-success bg-success/10' },
  investment: { icon: Briefcase, label: 'Investment', colorClass: 'text-primary bg-primary/10' },
  withdrawal: { icon: ArrowDownToLine, label: 'Withdrawal', colorClass: 'text-warning bg-warning/10' },
  debit: { icon: ArrowDownRight, label: 'Debit', colorClass: 'text-destructive bg-destructive/10' },
  pending_deposit: { icon: Clock, label: 'Pending Deposit', colorClass: 'text-warning bg-warning/10' },
  confirmed_deposit: { icon: CheckCircle, label: 'Deposit Confirmed', colorClass: 'text-success bg-success/10' },
  rejected_deposit: { icon: XCircle, label: 'Deposit Rejected', colorClass: 'text-destructive bg-destructive/10' },
  pending_withdrawal: { icon: Clock, label: 'Pending Withdrawal', colorClass: 'text-warning bg-warning/10' },
  approved_withdrawal: { icon: CheckCircle, label: 'Withdrawal Approved', colorClass: 'text-success bg-success/10' },
  rejected_withdrawal: { icon: XCircle, label: 'Withdrawal Rejected', colorClass: 'text-destructive bg-destructive/10' },
  investment_started: { icon: TrendingUp, label: 'Investment Started', colorClass: 'text-primary bg-primary/10' },
  investment_completed: { icon: CheckCircle, label: 'Investment Completed', colorClass: 'text-success bg-success/10' },
};

export function TransactionHistory() {
  const { user } = useAuth();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch deposits
      const { data: deposits } = await supabase
        .from('deposits')
        .select('id, amount, usd_amount, crypto_type, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch withdrawals
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('id, amount, status, created_at, crypto_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch active investments
      const { data: investments } = await supabase
        .from('active_investments')
        .select(`
          id, principal_amount, status, start_date, end_date, created_at,
          plan:investment_plans(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Combine and format events
      const allEvents: HistoryEvent[] = [];

      // Add transactions
      transactions?.forEach(tx => {
        allEvents.push({
          id: `tx-${tx.id}`,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          created_at: tx.created_at,
          source: 'transaction',
        });
      });

      // Add deposits
      deposits?.forEach(d => {
        const typeKey = d.status === 'pending' ? 'pending_deposit' : 
                        d.status === 'confirmed' ? 'confirmed_deposit' : 'rejected_deposit';
        allEvents.push({
          id: `dep-${d.id}`,
          type: typeKey,
          amount: d.usd_amount || d.amount,
          description: `${d.crypto_type} deposit - ${d.status}`,
          created_at: d.created_at,
          status: d.status,
          source: 'deposit',
        });
      });

      // Add withdrawals
      withdrawals?.forEach(w => {
        const typeKey = w.status === 'pending' ? 'pending_withdrawal' : 
                        w.status === 'approved' ? 'approved_withdrawal' : 'rejected_withdrawal';
        allEvents.push({
          id: `wd-${w.id}`,
          type: typeKey,
          amount: w.amount,
          description: `${w.crypto_type} withdrawal - ${w.status}`,
          created_at: w.created_at,
          status: w.status,
          source: 'withdrawal',
        });
      });

      // Add investment events
      investments?.forEach(inv => {
        allEvents.push({
          id: `inv-start-${inv.id}`,
          type: 'investment_started',
          amount: inv.principal_amount,
          description: `${inv.plan?.name || 'Investment'} Plan activated`,
          created_at: inv.created_at,
          source: 'investment',
        });
        
        if (inv.status === 'completed') {
          allEvents.push({
            id: `inv-complete-${inv.id}`,
            type: 'investment_completed',
            amount: inv.principal_amount,
            description: `${inv.plan?.name || 'Investment'} Plan completed`,
            created_at: inv.end_date,
            source: 'investment',
          });
        }
      });

      // Sort by date
      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Remove duplicates (deposits that also have transactions)
      const seen = new Set<string>();
      const uniqueEvents = allEvents.filter(e => {
        const key = `${e.type}-${Math.abs(e.amount)}-${new Date(e.created_at).toDateString()}`;
        if (e.source === 'transaction' && (e.type === 'deposit' || e.type === 'withdrawal' || e.type === 'investment')) {
          // Keep transaction records for deposits/withdrawals, skip duplicate deposit/withdrawal records
          return true;
        }
        if ((e.source === 'deposit' && e.status === 'confirmed') || 
            (e.source === 'withdrawal' && e.status === 'approved')) {
          // Skip confirmed deposits and approved withdrawals since they have transaction records
          return false;
        }
        return true;
      });

      setEvents(uniqueEvents);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredEvents = events.filter(e => {
    const matchesSearch = !searchTerm || 
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || 
      e.type.includes(filterType) ||
      e.source === filterType;
    
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="deposit">Deposits</SelectItem>
            <SelectItem value="withdrawal">Withdrawals</SelectItem>
            <SelectItem value="investment">Investments</SelectItem>
            <SelectItem value="roi">ROI Claims</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={fetchHistory}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No history found</p>
          <p className="text-sm">Your activity history will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event) => {
            const config = eventTypeConfig[event.type] || eventTypeConfig['deposit'];
            const IconComponent = config.icon;
            const isPositive = event.amount > 0 && !event.type.includes('investment') && !event.type.includes('pending');
            
            return (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors border border-border/50"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config.colorClass}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{config.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.description || new Date(event.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    event.type.includes('rejected') ? 'text-destructive' :
                    event.type.includes('pending') ? 'text-warning' :
                    isPositive ? 'text-success' : 'text-foreground'
                  }`}>
                    {event.type.includes('investment') || event.amount < 0 ? '-' : '+'}
                    ${Math.abs(event.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  {event.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      event.status === 'pending' ? 'bg-warning/10 text-warning' :
                      event.status === 'confirmed' || event.status === 'approved' ? 'bg-success/10 text-success' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {event.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
