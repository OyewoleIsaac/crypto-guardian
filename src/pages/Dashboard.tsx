import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { DepositModal } from '@/components/dashboard/DepositModal';
import { TransactionsList } from '@/components/dashboard/TransactionsList';

interface Investment {
  id: string;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [depositModalOpen, setDepositModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch investment
      const { data: investmentData, error: investmentError } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (investmentError) throw investmentError;
      setInvestment(investmentData);

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

      // Fetch pending deposits count
      const { count, error: depositsError } = await supabase
        .from('deposits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('status', 'pending');

      if (depositsError) throw depositsError;
      setPendingDeposits(count || 0);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-1">
              Welcome back! 👋
            </h1>
            <p className="text-muted-foreground">
              Here's an overview of your investments
            </p>
          </div>
          <Button 
            variant="hero" 
            size="lg" 
            className="gap-2"
            onClick={() => setDepositModalOpen(true)}
          >
            <Plus className="h-5 w-5" />
            New Deposit
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Balance */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Wallet className="h-6 w-6" />
                </div>
                <span className="text-primary-foreground/80 font-medium">Total Balance</span>
              </div>
              <p className="font-display text-4xl font-bold">
                ${investment?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="text-primary-foreground/70 text-sm mt-2">
                {investment?.currency || 'USD'}
              </p>
            </div>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/10" />
            <div className="absolute -top-8 -right-16 w-40 h-40 rounded-full bg-primary-foreground/5" />
          </div>

          {/* Active Investments */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <span className="text-muted-foreground font-medium">Investment Status</span>
            </div>
            <p className="font-display text-3xl font-bold text-foreground mb-1">
              Active
            </p>
            <div className="flex items-center gap-2 text-success text-sm">
              <ArrowUpRight className="h-4 w-4" />
              <span>Growing your wealth</span>
            </div>
          </div>

          {/* Pending Deposits */}
          <div className="rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <span className="text-muted-foreground font-medium">Pending Deposits</span>
            </div>
            <p className="font-display text-3xl font-bold text-foreground mb-1">
              {pendingDeposits}
            </p>
            <p className="text-muted-foreground text-sm">
              Awaiting confirmation
            </p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Recent Transactions
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchData}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          
          <TransactionsList 
            transactions={transactions} 
            isLoading={isLoading} 
          />
        </div>
      </main>

      <DepositModal 
        open={depositModalOpen} 
        onOpenChange={setDepositModalOpen}
        onSuccess={fetchData}
      />
    </div>
  );
}
