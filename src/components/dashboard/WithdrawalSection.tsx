import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Wallet, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ArrowDownToLine,
  RefreshCw,
  Calendar,
  DollarSign,
  Timer
} from 'lucide-react';
import { useWithdrawals, WithdrawalEligibility } from '@/hooks/useWithdrawals';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { format } from 'date-fns';
import { parseFinancialAmount, validateFinancialInput, MAX_FINANCIAL_AMOUNT } from '@/lib/financial-validation';

interface WithdrawalSectionProps {
  onSuccess?: () => void;
}

export function WithdrawalSection({ onSuccess }: WithdrawalSectionProps = {}) {
  const { 
    withdrawals, 
    isLoading, 
    checkEligibility, 
    submitWithdrawal,
    refetch 
  } = useWithdrawals();
  const { enabledMethods } = usePaymentMethods();
  
  const [eligibility, setEligibility] = useState<WithdrawalEligibility | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<(typeof enabledMethods)[0] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveMethod = selectedMethod || enabledMethods[0] || null;
  const cryptoType = effectiveMethod?.crypto_type || 'USDT';
  const network = effectiveMethod?.network || null;

  useEffect(() => {
    if (enabledMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0]);
    }
  }, [enabledMethods, selectedMethod]);

  useEffect(() => {
    const checkAndSetEligibility = async () => {
      setIsCheckingEligibility(true);
      try {
        const result = await checkEligibility();
        setEligibility(result);
      } catch (error) {
        console.error('Error checking eligibility:', error);
      } finally {
        setIsCheckingEligibility(false);
      }
    };
    
    checkAndSetEligibility();
  }, [checkEligibility]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate amount using financial validation
    const validationError = validateFinancialInput(amount);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    const numAmount = parseFinancialAmount(amount);
    if (numAmount === null) {
      toast.error('Invalid amount format');
      return;
    }
    
    // Check against available balance
    if (eligibility?.availableBalance && numAmount > eligibility.availableBalance) {
      toast.error(`Amount exceeds available balance of $${eligibility.availableBalance.toFixed(2)}`);
      return;
    }

    if (!walletAddress.trim()) {
      toast.error('Please enter a wallet address');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitWithdrawal(numAmount, walletAddress.trim(), cryptoType, network);
      toast.success('Withdrawal request submitted. Amount deducted. Processing typically takes 1–3 hours.');
      setIsModalOpen(false);
      setAmount('');
      setWalletAddress('');
      setSelectedMethod(null);
      
      const newEligibility = await checkEligibility();
      setEligibility(newEligibility);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit withdrawal request');
    } finally {
      setIsSubmitting(false);
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

  const availablePaymentMethods = enabledMethods;

  if (isCheckingEligibility) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Eligibility Status Card */}
      <Card className={`p-6 border-2 ${
        eligibility?.canWithdraw 
          ? 'border-success/30 bg-success/5' 
          : 'border-warning/30 bg-warning/5'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${
            eligibility?.canWithdraw ? 'bg-success/10' : 'bg-warning/10'
          }`}>
            {eligibility?.canWithdraw ? (
              <CheckCircle className="h-6 w-6 text-success" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-warning" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              {eligibility?.canWithdraw ? 'Eligible for Withdrawal' : 'Withdrawal Not Available'}
            </h3>
            <p className="text-muted-foreground text-sm mb-3">
              {eligibility?.reason}
            </p>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Available: <strong className="text-foreground">${eligibility?.availableBalance?.toFixed(2) || '0.00'}</strong></span>
              </div>
              {eligibility?.daysUntilEligible && (
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span>Days remaining: <strong className="text-foreground">{eligibility.daysUntilEligible}</strong></span>
                </div>
              )}
            </div>
          </div>
          
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="hero" 
                disabled={!eligibility?.canWithdraw}
                className="shrink-0"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Request Withdrawal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Withdrawal</DialogTitle>
                <DialogDescription>
                  Select a payment method and enter your wallet address. The network must match our deposit methods.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="1"
                      max={eligibility?.availableBalance || 0}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum: ${eligibility?.availableBalance?.toFixed(2) || '0.00'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availablePaymentMethods.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setSelectedMethod(pm)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          selectedMethod?.id === pm.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <p className="font-medium text-sm">{pm.crypto_type}</p>
                        {pm.network && (
                          <p className="text-xs text-muted-foreground mt-0.5">{pm.network}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  {availablePaymentMethods.length === 0 && (
                    <p className="text-sm text-muted-foreground">No payment methods configured. Contact support.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress">
                    {cryptoType} Wallet Address {network && `(${network})`}
                  </Label>
                  <Input
                    id="walletAddress"
                    type="text"
                    placeholder={`Enter your ${cryptoType} address on ${network || 'correct network'}`}
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    required
                  />
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Use only the {network || cryptoType} network. Wrong network may result in loss of funds.
                  </p>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Withdrawal History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-foreground">Withdrawal History</h3>
            <p className="text-sm text-muted-foreground">Your past and pending withdrawal requests</p>
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No withdrawal requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ArrowDownToLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      ${withdrawal.amount.toFixed(2)} {withdrawal.crypto_type}
                    </p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {withdrawal.wallet_address}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(withdrawal.status)}
                  <p className="text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {format(new Date(withdrawal.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending notice & Info Box */}
      {withdrawals.some(w => w.status === 'pending') && (
        <Card className="p-4 bg-warning/5 border-warning/30">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Pending Withdrawal</p>
              <p className="text-muted-foreground">
                Withdrawals typically take 1–3 hours to process. In some cases, processing can take up to 3 business days.
              </p>
            </div>
          </div>
        </Card>
      )}
      <Card className="p-4 bg-muted/50 border-dashed">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Important Information</p>
            <ul className="list-disc list-inside space-y-1">
              <li>The amount is deducted from your balance when you submit a withdrawal request</li>
              <li>Processing typically takes 1–3 hours; in some cases up to 3 business days</li>
              <li>Use the same network as for deposits (e.g. ERC-20, TRC-20) for the selected crypto</li>
              <li>Ensure your wallet address is correct — transactions cannot be reversed</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
