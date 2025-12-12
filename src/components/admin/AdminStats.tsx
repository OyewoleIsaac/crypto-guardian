import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, DollarSign, TrendingUp } from 'lucide-react';

interface Stats {
  totalUsers: number;
  pendingDeposits: number;
  totalInvestments: number;
  confirmedDeposits: number;
}

export function AdminStats() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingDeposits: 0,
    totalInvestments: 0,
    confirmedDeposits: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get pending deposits
      const { count: pendingCount } = await supabase
        .from('deposits')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get confirmed deposits count
      const { count: confirmedCount } = await supabase
        .from('deposits')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed');

      // Get total investments
      const { data: investments } = await supabase
        .from('investments')
        .select('balance');

      const totalInvestments = investments?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0;

      setStats({
        totalUsers: usersCount || 0,
        pendingDeposits: pendingCount || 0,
        totalInvestments,
        confirmedDeposits: confirmedCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Pending Deposits',
      value: stats.pendingDeposits,
      icon: Clock,
      color: 'bg-warning/10 text-warning',
    },
    {
      label: 'Total Investments',
      value: `$${stats.totalInvestments.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-success/10 text-success',
    },
    {
      label: 'Confirmed Deposits',
      value: stats.confirmedDeposits,
      icon: TrendingUp,
      color: 'bg-accent/10 text-accent',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl bg-card border border-border p-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {isLoading ? '...' : stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
