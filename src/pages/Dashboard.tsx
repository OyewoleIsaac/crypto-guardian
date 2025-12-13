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
  RefreshCw,
  Crown,
  Diamond,
  Medal,
  BarChart3,
  Calendar
} from 'lucide-react';
import { DepositModal } from '@/components/dashboard/DepositModal';
import { TransactionsList } from '@/components/dashboard/TransactionsList';
import { InvestmentPlans, PLANS } from '@/components/dashboard/InvestmentPlans';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Investment {
  id: string;
  balance: number;
  currency: string;
  plan: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const planIcons: Record<string, any> = {
  silver: Medal,
  gold: Crown,
  diamond: Diamond,
};

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

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
      const { data: investmentData, error: investmentError } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (investmentError) throw investmentError;
      setInvestment(investmentData);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

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

  const handleSelectPlan = async (planId: string) => {
    if (!user) return;
    setIsUpdatingPlan(true);
    try {
      const { error } = await supabase
        .from('investments')
        .update({ plan: planId })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(`Switched to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan!`);
      fetchData();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = investment?.plan || 'silver';
  const PlanIcon = planIcons[currentPlan] || Medal;
  const planDetails = PLANS.find(p => p.id === currentPlan);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-1">
              Investment Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage your crypto investments and track your portfolio
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Balance */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground col-span-1 lg:col-span-2">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-primary-foreground/80 font-medium">Total Balance</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      currentPlan === 'diamond' ? 'bg-cyan-500/20 text-cyan-100' :
                      currentPlan === 'gold' ? 'bg-amber-500/20 text-amber-100' :
                      'bg-slate-500/20 text-slate-100'
                    }`}>
                      <PlanIcon className="h-3 w-3" />
                      {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                    </span>
                  </div>
                </div>
              </div>
              <p className="font-display text-4xl font-bold">
                ${investment?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="text-primary-foreground/70 text-sm mt-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Expected ROI: {planDetails?.roi || '5-8%'} / 30 days
              </p>
            </div>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/10" />
            <div className="absolute -top-8 -right-16 w-40 h-40 rounded-full bg-primary-foreground/5" />
          </div>

          {/* Active Investments */}
          <div className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <BarChart3 className="h-6 w-6 text-success" />
              </div>
              <span className="text-muted-foreground font-medium">Investment Status</span>
            </div>
            <p className="font-display text-2xl font-bold text-foreground mb-1">
              Active
            </p>
            <div className="flex items-center gap-2 text-success text-sm">
              <ArrowUpRight className="h-4 w-4" />
              <span>Growing your wealth</span>
            </div>
          </div>

          {/* Pending Deposits */}
          <div className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <span className="text-muted-foreground font-medium">Pending</span>
            </div>
            <p className="font-display text-2xl font-bold text-foreground mb-1">
              {pendingDeposits} Deposit{pendingDeposits !== 1 ? 's' : ''}
            </p>
            <p className="text-muted-foreground text-sm">
              Awaiting confirmation
            </p>
          </div>
        </div>

        {/* Tabs Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <Crown className="h-4 w-4" />
              Investment Plans
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Calendar className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">Account Created</p>
                <p className="font-semibold text-foreground">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
                <p className="font-semibold text-foreground">{transactions.length}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-sm text-muted-foreground mb-1">Account Type</p>
                <p className="font-semibold text-foreground capitalize">{currentPlan} Investor</p>
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
          </TabsContent>

          <TabsContent value="plans">
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="mb-6">
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Choose Your Investment Plan
                </h2>
                <p className="text-muted-foreground">
                  Select a plan that matches your investment goals. Higher tiers offer better returns and exclusive benefits.
                </p>
              </div>
              
              <InvestmentPlans 
                currentPlan={currentPlan}
                onSelectPlan={handleSelectPlan}
                isLoading={isUpdatingPlan}
              />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Transaction History
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
          </TabsContent>
        </Tabs>
      </main>

      <DepositModal 
        open={depositModalOpen} 
        onOpenChange={setDepositModalOpen}
        onSuccess={fetchData}
      />
    </div>
  );
}