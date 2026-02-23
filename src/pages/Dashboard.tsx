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
  Calendar,
  User,
  Briefcase,
  Users,
  ArrowDownToLine,
  Gift
} from 'lucide-react';
import { NewDepositModal } from '@/components/dashboard/NewDepositModal';
import { TransactionsList } from '@/components/dashboard/TransactionsList';
import { TransactionHistory } from '@/components/dashboard/TransactionHistory';
import { InvestmentPlans } from '@/components/dashboard/InvestmentPlans';
import { ActiveInvestmentCard } from '@/components/dashboard/ActiveInvestmentCard';
import { ProfileSection, PasswordChangeSection } from '@/components/profile/ProfileSection';
import { ReferralSection } from '@/components/dashboard/ReferralSection';
import { WithdrawalSection } from '@/components/dashboard/WithdrawalSection';
import { ResponsiveTabs, TabsContent } from '@/components/ui/responsive-tabs';
import { useActiveInvestments } from '@/hooks/useActiveInvestments';
import { InvestmentPlan } from '@/hooks/useInvestmentPlans';

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
  const [isClaimAllLoading, setIsClaimAllLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const switchToTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'investments') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.getElementById('tab-investments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });
    }
  };

  const {
    activeInvestments,
    isLoading: investmentsLoading,
    refetch: refetchInvestments,
    getClaimableRoi,
    canWithdraw,
    getDaysRemaining
  } = useActiveInvestments();

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

  const handleSelectPlan = (plan: InvestmentPlan) => {
    if (!user) return;

    // Plan is selected, open deposit modal with preselected plan
    setDepositModalOpen(true);
    toast.info(`To activate ${plan.name}, please complete a deposit of at least $${plan.min_investment.toLocaleString()}`);
  };

  const handleRefreshInvestments = () => {
    fetchData();
    refetchInvestments();
  };

  const handleClaimAllCompleted = async () => {
    if (!user) return;

    const claimableInvestments = activeInvestments.filter(inv => canWithdraw(inv));

    if (claimableInvestments.length === 0) {
      toast.info('No completed investments to claim');
      return;
    }

    setIsClaimAllLoading(true);

    try {
      // Process each completed investment: mark completed, compute payout, and record transaction
      const payouts = await Promise.all(
        claimableInvestments.map(async (inv) => {
          const remainingRoi = getClaimableRoi(inv);
          const totalAmount = inv.principal_amount + remainingRoi;

          const { error: updateError } = await supabase
            .from('active_investments')
            .update({
              status: 'completed',
              claimed_roi: inv.claimed_roi + remainingRoi,
            })
            .eq('id', inv.id);

          if (updateError) throw updateError;

          const { error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              type: 'investment_completed',
              amount: totalAmount,
              description: 'Principal and ROI claimed',
            });

          if (txError) throw txError;

          return totalAmount;
        })
      );

      const totalPayout = payouts.reduce((sum, amount) => sum + amount, 0);

      // Update user balance once with the total payout
      const { data: currentInvestment, error: fetchError } = await supabase
        .from('investments')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const baseBalance = Number(currentInvestment?.balance || 0);
      const newBalance = baseBalance + totalPayout;

      if (currentInvestment) {
        const { error: balanceError } = await supabase
          .from('investments')
          .update({ balance: newBalance })
          .eq('user_id', user.id);

        if (balanceError) throw balanceError;
      } else {
        const { error: insertError } = await supabase
          .from('investments')
          .insert({
            user_id: user.id,
            balance: newBalance,
          });

        if (insertError) throw insertError;
      }

      toast.success(
        `Successfully claimed rewards from ${claimableInvestments.length} investment${claimableInvestments.length > 1 ? 's' : ''} totaling $${totalPayout.toFixed(2)}`
      );

      fetchData();
      refetchInvestments();
    } catch (error) {
      console.error('Error claiming all rewards:', error);
      toast.error('Failed to claim all rewards');
    } finally {
      setIsClaimAllLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentBalance = investment?.balance || 0;

  // Get the active investment plan type (if any active investment)
  const activeInvestmentPlan = activeInvestments.length > 0
    ? activeInvestments[0].plan?.name?.toLowerCase() || 'silver'
    : null;
  const currentPlan = activeInvestmentPlan || investment?.plan || 'silver';
  const PlanIcon = planIcons[currentPlan] || Medal;

  // Calculate total active ROI
  const totalActiveInvestment = activeInvestments.reduce((sum, inv) => sum + inv.principal_amount, 0);
  const totalClaimableRoi = activeInvestments.reduce((sum, inv) => sum + getClaimableRoi(inv), 0);
  const hasCompletedInvestments = activeInvestments.some(inv => canWithdraw(inv));

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
        <div className={`grid grid-cols-1 md:grid-cols-2 ${activeInvestments.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6 mb-8`}>
          {/* Total Balance */}
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-primary p-6 text-primary-foreground ${activeInvestments.length > 0 ? 'col-span-1 lg:col-span-2' : 'col-span-1 lg:col-span-2'}`}>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-primary-foreground/80 font-medium">Available Balance</span>
                  {activeInvestments.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${currentPlan === 'diamond' ? 'bg-cyan-500/20 text-cyan-100' :
                        currentPlan === 'gold' ? 'bg-amber-500/20 text-amber-100' :
                          'bg-slate-500/20 text-slate-100'
                        }`}>
                        <PlanIcon className="h-3 w-3" />
                        {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="font-display text-4xl font-bold">
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              {activeInvestments.length > 0 && (
                <p className="text-primary-foreground/70 text-sm mt-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Claimable ROI: ${totalClaimableRoi.toFixed(2)}
                </p>
              )}
            </div>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/10" />
            <div className="absolute -top-8 -right-16 w-40 h-40 rounded-full bg-primary-foreground/5" />
          </div>

          {/* Active Investments - Only show if there are active investments */}
          {activeInvestments.length > 0 && (
            <button
              onClick={() => switchToTab('investments')}
              className="rounded-2xl bg-card border border-border p-6 hover:shadow-lg hover:border-primary/50 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 group-hover:bg-success/20 transition-colors">
                  <Briefcase className="h-6 w-6 text-success" />
                </div>
                <span className="text-muted-foreground font-medium">Active Investments</span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground mb-1">
                ${totalActiveInvestment.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-success text-sm">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>{activeInvestments.length} active plan{activeInvestments.length !== 1 ? 's' : ''}</span>
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Click to view →
                </span>
              </div>
            </button>
          )}

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
        <ResponsiveTabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={(tab) => switchToTab(tab)}
          tabs={[
            { value: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
            { value: "investments", label: "My Investments", icon: <Briefcase className="h-4 w-4" /> },
            { value: "plans", label: "Investment Plans", icon: <Crown className="h-4 w-4" /> },
            { value: "withdrawals", label: "Withdrawals", icon: <ArrowDownToLine className="h-4 w-4" /> },
            { value: "history", label: "History", icon: <Calendar className="h-4 w-4" /> },
            { value: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
            { value: "referrals", label: "Referrals", icon: <Users className="h-4 w-4" /> },
          ]}
        >

          <TabsContent value="overview" className="space-y-6">
            {/* Active Investment Summary (if any) */}
            {activeInvestments.length > 0 && (
              <div className="rounded-2xl bg-gradient-to-r from-success/10 to-primary/10 border border-success/20 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                      Active Investments
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      You have ${totalActiveInvestment.toLocaleString()} invested across {activeInvestments.length} plan{activeInvestments.length !== 1 ? 's' : ''}
                    </p>
                    {totalClaimableRoi > 0 && (
                      <p className="text-success font-medium mt-1">
                        ${totalClaimableRoi.toFixed(2)} ROI available to claim!
                      </p>
                    )}
                  </div>
                  <Button
                    variant="success"
                    className="gap-2"
                    onClick={() => switchToTab('investments')}
                  >
                    <Briefcase className="h-4 w-4" />
                    View Investments
                  </Button>
                </div>
              </div>
            )}

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
                <p className="font-semibold text-foreground capitalize">
                  {activeInvestments.length > 0 ? `${currentPlan} Investor` : 'Standard'}
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
          </TabsContent>

          <TabsContent value="investments" id="tab-investments" className="space-y-6 scroll-mt-8">
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground mb-1">
                    Active Investments
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Track your investments and claim your ROI
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasCompletedInvestments && (
                    <Button
                      variant="success"
                      size="sm"
                      className="gap-2"
                      onClick={handleClaimAllCompleted}
                      disabled={isClaimAllLoading}
                    >
                      <Gift className="h-4 w-4" />
                      {isClaimAllLoading ? 'Claiming...' : 'Claim All Rewards'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refetchInvestments}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              {investmentsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : activeInvestments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No active investments</p>
                  <p className="text-sm mt-1">Select a plan and make a deposit to start investing</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setDepositModalOpen(true)}
                  >
                    Start Investing
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {activeInvestments.map((inv) => (
                    <ActiveInvestmentCard
                      key={inv.id}
                      investment={inv}
                      claimableRoi={getClaimableRoi(inv)}
                      daysRemaining={getDaysRemaining(inv)}
                      canWithdraw={canWithdraw(inv)}
                      onUpdate={handleRefreshInvestments}
                    />
                  ))}
                </div>
              )}

              {/* Withdrawal Notice */}
              {activeInvestments.length > 0 && (
                <div className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning font-medium">
                    ⚠️ Important: Withdrawals will be available after the investment period ends.
                    You can claim your daily ROI at any time, but your principal will remain locked until maturity.
                  </p>
                </div>
              )}
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
                currentBalance={currentBalance}
                onSelectPlan={handleSelectPlan}
                onDepositSuccess={() => {
                  fetchData();
                  refetchInvestments();
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="withdrawals">
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="mb-6">
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Withdrawals
                </h2>
                <p className="text-muted-foreground">
                  Request withdrawals from your available balance.
                </p>
              </div>
              <WithdrawalSection onSuccess={fetchData} />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="rounded-2xl bg-card border border-border p-6">
              <div className="mb-6">
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Activity History
                </h2>
                <p className="text-muted-foreground">
                  Complete record of all your deposits, withdrawals, investments and ROI claims.
                </p>
              </div>

              <TransactionHistory />
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <div className="grid gap-6 md:grid-cols-2">
              <ProfileSection balance={currentBalance} />
              <PasswordChangeSection />
            </div>
          </TabsContent>

          <TabsContent value="referrals">
            <ReferralSection />
          </TabsContent>
        </ResponsiveTabs>
      </main>

      <NewDepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        onSuccess={() => {
          fetchData();
          refetchInvestments();
        }}
      />
    </div>
  );
}
