import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  Search,
  RefreshCw,
  DollarSign,
  TrendingUp,
  ArrowUpDown
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingDeposits } from '@/components/admin/PendingDeposits';
import { UserManagement } from '@/components/admin/UserManagement';
import { AdminStats } from '@/components/admin/AdminStats';
import { PlanManagement } from '@/components/admin/PlanManagement';
import { PaymentMethodsManagement } from '@/components/admin/PaymentMethodsManagement';
import { ProfileSection, PasswordChangeSection } from '@/components/profile/ProfileSection';

export default function Admin() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        toast.error('Access denied. Admin privileges required.');
        navigate('/dashboard');
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading || !user || !isAdmin) {
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
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-1">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage users, deposits, and investments
          </p>
        </div>

        {/* Stats */}
        <AdminStats />

        {/* Tabs */}
        <Tabs defaultValue="deposits" className="mt-8">
          <TabsList className="grid w-full max-w-4xl grid-cols-5">
            <TabsTrigger value="deposits" className="gap-2">
              <Clock className="h-4 w-4" />
              Deposits
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <Users className="h-4 w-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits" className="mt-6">
            <PendingDeposits />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="plans" className="mt-6">
            <PlanManagement />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentMethodsManagement />
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
              <ProfileSection showBalance={false} />
              <PasswordChangeSection />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
