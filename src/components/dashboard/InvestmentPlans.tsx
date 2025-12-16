import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Crown, Diamond, Medal, Gem, Star, Zap } from 'lucide-react';
import { useInvestmentPlans, InvestmentPlan } from '@/hooks/useInvestmentPlans';
import { InsufficientBalanceModal } from './InsufficientBalanceModal';
import { NewDepositModal } from './NewDepositModal';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, any> = {
  medal: Medal,
  crown: Crown,
  diamond: Diamond,
  gem: Gem,
  star: Star,
  zap: Zap,
};

// Legacy plans for fallback
const LEGACY_PLANS = [
  {
    id: 'silver',
    name: 'Silver',
    icon: Medal,
    minDeposit: 100,
    maxDeposit: 4999,
    roi: '5-8%',
    duration: '30 days',
    features: ['Daily profit updates', 'Email support', 'Basic analytics'],
    color: 'from-slate-400 to-slate-500',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-300',
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: Crown,
    minDeposit: 5000,
    maxDeposit: 19999,
    roi: '10-15%',
    duration: '30 days',
    features: ['Real-time tracking', 'Priority support', 'Advanced analytics', 'Compound interest'],
    popular: true,
    color: 'from-amber-400 to-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-400',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    icon: Diamond,
    minDeposit: 20000,
    maxDeposit: null,
    roi: '18-25%',
    duration: '30 days',
    features: ['VIP manager', '24/7 phone support', 'Premium analytics', 'Compound interest', 'Bonus rewards'],
    color: 'from-cyan-400 to-blue-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-400',
  },
];

interface InvestmentPlansProps {
  currentPlan?: string;
  currentBalance?: number;
  onSelectPlan: (plan: InvestmentPlan) => void;
  isLoading?: boolean;
  onDepositSuccess?: () => void;
}

export function InvestmentPlans({ 
  currentPlan, 
  currentBalance = 0, 
  onSelectPlan, 
  isLoading: externalLoading,
  onDepositSuccess
}: InvestmentPlansProps) {
  const { plans, isLoading: plansLoading } = useInvestmentPlans();
  const [insufficientModalOpen, setInsufficientModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);

  const activePlans = plans.filter(p => p.is_active);
  const isLoading = plansLoading || externalLoading;

  const handlePlanClick = (plan: InvestmentPlan) => {
    // Check if user has sufficient balance
    if (currentBalance < plan.min_investment) {
      setSelectedPlan(plan);
      setInsufficientModalOpen(true);
      return;
    }
    
    // User has sufficient balance, proceed with plan selection
    onSelectPlan(plan);
  };

  const handleDepositClick = () => {
    setInsufficientModalOpen(false);
    setDepositModalOpen(true);
  };

  const handleDepositSuccess = () => {
    setDepositModalOpen(false);
    setSelectedPlan(null);
    onDepositSuccess?.();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border-2 border-border p-6">
            <div className="text-center mb-6">
              <Skeleton className="h-16 w-16 rounded-2xl mx-auto mb-4" />
              <Skeleton className="h-8 w-24 mx-auto mb-2" />
              <Skeleton className="h-10 w-20 mx-auto" />
            </div>
            <Skeleton className="h-20 rounded-xl mb-6" />
            <div className="space-y-3 mb-6">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-5 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activePlans.map((plan, index) => {
          const isCurrentPlan = currentPlan === plan.id;
          const Icon = iconMap[plan.icon_name] || Medal;
          const colorClass = plan.color_class || 'from-slate-400 to-slate-500';
          const isPopular = index === 1; // Middle plan is popular
          
          // Determine background and border colors based on plan
          const bgColor = plan.name.toLowerCase().includes('diamond') ? 'bg-cyan-500/10' :
                         plan.name.toLowerCase().includes('gold') ? 'bg-amber-500/10' :
                         'bg-slate-500/10';
          const borderColor = plan.name.toLowerCase().includes('diamond') ? 'border-cyan-400' :
                             plan.name.toLowerCase().includes('gold') ? 'border-amber-400' :
                             'border-slate-300';
          
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 transition-all duration-300 ${
                isCurrentPlan 
                  ? `${borderColor} shadow-lg` 
                  : 'border-border hover:border-primary/30'
              } ${isPopular ? 'md:-mt-4 md:mb-4' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-gold text-xs font-bold text-accent-foreground">
                  MOST POPULAR
                </div>
              )}
              
              {/* Plan Header */}
              <div className="text-center mb-6">
                <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClass} mb-4`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-4xl font-bold text-primary mt-2">{plan.roi_percentage}%</p>
                <p className="text-sm text-muted-foreground">Return over {plan.duration_days} days</p>
              </div>

              {/* Investment Range */}
              <div className={`rounded-xl ${bgColor} p-4 mb-6`}>
                <p className="text-sm text-muted-foreground text-center">Investment Range</p>
                <p className="text-center font-semibold text-foreground">
                  ${plan.min_investment.toLocaleString()} - {plan.max_investment ? `$${plan.max_investment.toLocaleString()}` : 'Unlimited'}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              <Button
                variant={isCurrentPlan ? 'default' : 'outline'}
                className="w-full"
                onClick={() => handlePlanClick(plan)}
                disabled={isCurrentPlan}
              >
                {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
              </Button>
            </div>
          );
        })}
      </div>

      <InsufficientBalanceModal
        open={insufficientModalOpen}
        onOpenChange={setInsufficientModalOpen}
        requiredAmount={selectedPlan?.min_investment || 0}
        currentBalance={currentBalance}
        planName={selectedPlan?.name || ''}
        onDeposit={handleDepositClick}
      />

      <NewDepositModal
        open={depositModalOpen}
        onOpenChange={setDepositModalOpen}
        onSuccess={handleDepositSuccess}
        selectedPlanId={selectedPlan?.id}
        currentBalance={currentBalance}
      />
    </>
  );
}

export { LEGACY_PLANS as PLANS };
