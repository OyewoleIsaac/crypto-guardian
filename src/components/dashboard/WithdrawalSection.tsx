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

export function WithdrawalSection() {
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
  const [cryptoType, setCryptoType] = useState('USDT');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!walletAddress.trim()) {
      toast.error('Please enter a wallet address');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitWithdrawal(numAmount, walletAddress.trim(), cryptoType);
      toast.success('Withdrawal request submitted successfully!');
      setIsModalOpen(false);
      setAmount('');
      setWalletAddress('');
      
      // Re-check eligibility
      const newEligibility = await checkEligibility();
      setEligibility(newEligibility);
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
                  Enter the amount and wallet address for your withdrawal.
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
                  <Label htmlFor="cryptoType">Cryptocurrency</Label>
                  <Select value={cryptoType} onValueChange={setCryptoType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cryptocurrency" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePaymentMethods.length > 0 ? (
                        availablePaymentMethods.map((pm) => (
                          <SelectItem key={pm.id} value={pm.crypto_type}>
                            {pm.crypto_name} ({pm.crypto_type})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="USDT">USDT</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address</Label>
                  <Input
                    id="walletAddress"
                    type="text"
                    placeholder="Enter your wallet address"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Make sure to enter the correct {cryptoType} wallet address.
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

      {/* Info Box */}
      <Card className="p-4 bg-muted/50 border-dashed">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Important Information</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Withdrawals are only available 30 days after your first investment</li>
              <li>All withdrawal requests require admin approval</li>
              <li>Processing time may vary depending on the cryptocurrency network</li>
              <li>Ensure your wallet address is correct - transactions cannot be reversed</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
