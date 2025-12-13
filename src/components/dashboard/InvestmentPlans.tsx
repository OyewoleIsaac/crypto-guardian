import { Button } from '@/components/ui/button';
import { Check, Crown, Diamond, Medal } from 'lucide-react';

const PLANS = [
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
  currentPlan: string;
  onSelectPlan: (planId: string) => void;
  isLoading?: boolean;
}

export function InvestmentPlans({ currentPlan, onSelectPlan, isLoading }: InvestmentPlansProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {PLANS.map((plan) => {
        const isCurrentPlan = currentPlan === plan.id;
        const Icon = plan.icon;
        
        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl border-2 p-6 transition-all duration-300 ${
              isCurrentPlan 
                ? `${plan.borderColor} shadow-lg` 
                : 'border-border hover:border-primary/30'
            } ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-gold text-xs font-bold text-accent-foreground">
                MOST POPULAR
              </div>
            )}
            
            {/* Plan Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${plan.color} mb-4`}>
                <Icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">{plan.name}</h3>
              <p className="text-4xl font-bold text-primary mt-2">{plan.roi}</p>
              <p className="text-sm text-muted-foreground">Return per {plan.duration}</p>
            </div>

            {/* Investment Range */}
            <div className={`rounded-xl ${plan.bgColor} p-4 mb-6`}>
              <p className="text-sm text-muted-foreground text-center">Investment Range</p>
              <p className="text-center font-semibold text-foreground">
                ${plan.minDeposit.toLocaleString()} - {plan.maxDeposit ? `$${plan.maxDeposit.toLocaleString()}` : 'Unlimited'}
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${plan.color} flex items-center justify-center flex-shrink-0`}>
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
              onClick={() => onSelectPlan(plan.id)}
              disabled={isLoading || isCurrentPlan}
            >
              {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export { PLANS };