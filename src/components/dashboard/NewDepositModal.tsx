import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useInvestmentPlans } from '@/hooks/useInvestmentPlans';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { toast } from 'sonner';
import { Copy, Check, Upload, X, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

interface NewDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  selectedPlanId?: string;
  currentBalance?: number;
}

export function NewDepositModal({ 
  open, 
  onOpenChange, 
  onSuccess,
  selectedPlanId,
  currentBalance = 0,
}: NewDepositModalProps) {
  const { user } = useAuth();
  const { enabledMethods, isLoading: methodsLoading } = usePaymentMethods();
  const { plans } = useInvestmentPlans();
  
  const cryptoSymbols = useMemo(() => enabledMethods.map(m => m.crypto_type), [enabledMethods]);
  const { prices, isLoading: pricesLoading, convertUsdToCrypto, convertCryptoToUsd, refetch: refetchPrices } = useCryptoPrices(cryptoSymbols);
  
  const [step, setStep] = useState<'plan' | 'amount' | 'payment'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(selectedPlanId || null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [usdAmount, setUsdAmount] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set initial plan if provided
  useEffect(() => {
    if (selectedPlanId) {
      setSelectedPlan(selectedPlanId);
      setStep('amount');
    }
  }, [selectedPlanId]);

  // Auto-select first enabled method
  useEffect(() => {
    if (enabledMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0].crypto_type);
    }
  }, [enabledMethods, selectedMethod]);

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan);
  const selectedPaymentMethod = enabledMethods.find(m => m.crypto_type === selectedMethod);

  const minRequired = selectedPlanDetails?.min_investment || 0;
  const amountNeeded = Math.max(0, minRequired - currentBalance);

  // Handle USD amount change
  const handleUsdChange = (value: string) => {
    setUsdAmount(value);
    if (value && selectedMethod) {
      const crypto = convertUsdToCrypto(parseFloat(value), selectedMethod);
      setCryptoAmount(crypto > 0 ? crypto.toFixed(8) : '');
    } else {
      setCryptoAmount('');
    }
  };

  // Handle crypto amount change
  const handleCryptoChange = (value: string) => {
    setCryptoAmount(value);
    if (value && selectedMethod) {
      const usd = convertCryptoToUsd(parseFloat(value), selectedMethod);
      setUsdAmount(usd > 0 ? usd.toFixed(2) : '');
    } else {
      setUsdAmount('');
    }
  };

  // Change crypto method
  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    // Recalculate crypto amount
    if (usdAmount) {
      const crypto = convertUsdToCrypto(parseFloat(usdAmount), method);
      setCryptoAmount(crypto > 0 ? crypto.toFixed(8) : '');
    }
  };

  const copyAddress = () => {
    if (selectedPaymentMethod) {
      navigator.clipboard.writeText(selectedPaymentMethod.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setProofImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setProofImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!usdAmount || parseFloat(usdAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!proofImage) {
      toast.error('Please upload a transaction proof image');
      return;
    }

    if (!selectedPlan || !selectedMethod || !selectedPaymentMethod) {
      toast.error('Please complete all steps');
      return;
    }

    setIsLoading(true);
    try {
      // Upload proof image
      const fileExt = proofImage.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('deposit-proofs')
        .upload(fileName, proofImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('deposit-proofs')
        .getPublicUrl(fileName);

      // Create deposit record
      const { error } = await supabase.from('deposits').insert({
        user_id: user?.id,
        amount: parseFloat(usdAmount),
        usd_amount: parseFloat(usdAmount),
        crypto_type: selectedMethod,
        crypto_amount: parseFloat(cryptoAmount),
        conversion_rate: prices[selectedMethod] || 0,
        wallet_address: selectedPaymentMethod.wallet_address,
        status: 'pending',
        proof_image_url: publicUrl,
        plan_id: selectedPlan,
      });

      if (error) throw error;

      toast.success('Deposit submitted! Awaiting admin confirmation.');
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Failed to create deposit');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('plan');
    setSelectedPlan(null);
    setSelectedMethod(enabledMethods[0]?.crypto_type || null);
    setUsdAmount('');
    setCryptoAmount('');
    setProofImage(null);
    setPreviewUrl(null);
  };

  const canProceedToPayment = () => {
    const totalAfterDeposit = currentBalance + parseFloat(usdAmount || '0');
    return totalAfterDeposit >= minRequired;
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Investment Deposit</DialogTitle>
        </DialogHeader>

        {/* Steps Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {['plan', 'amount', 'payment'].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : i < ['plan', 'amount', 'payment'].indexOf(step)
                  ? 'bg-success text-success-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < 2 && <div className="h-0.5 flex-1 bg-border mx-2" />}
            </div>
          ))}
        </div>

        <div className="space-y-5 py-4">
          {/* Step 1: Select Plan */}
          {step === 'plan' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select an investment plan to proceed with your deposit.
              </p>
              <div className="space-y-2">
                {plans.filter(p => p.is_active).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedPlan === plan.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Min: ${plan.min_investment.toLocaleString()} | ROI: {plan.roi_percentage}% / {plan.duration_days} days
                        </p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 ${
                        selectedPlan === plan.id
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}>
                        {selectedPlan === plan.id && (
                          <Check className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <Button 
                className="w-full gap-2" 
                onClick={() => setStep('amount')}
                disabled={!selectedPlan}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Enter Amount */}
          {step === 'amount' && (
            <div className="space-y-4">
              {selectedPlanDetails && (
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground mb-1">Selected Plan</p>
                  <p className="font-semibold text-foreground">{selectedPlanDetails.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Minimum investment: ${selectedPlanDetails.min_investment.toLocaleString()}
                  </p>
                </div>
              )}

              {amountNeeded > 0 && (
                <div className="flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/20 p-3">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                  <p className="text-sm text-warning">
                    You need at least <strong>${amountNeeded.toLocaleString()}</strong> more to activate this plan.
                    Current balance: ${currentBalance.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Crypto Selection */}
              <div className="space-y-2">
                <Label>Select Cryptocurrency</Label>
                <div className="grid grid-cols-3 gap-2">
                  {enabledMethods.map((method) => (
                    <button
                      key={method.crypto_type}
                      type="button"
                      onClick={() => handleMethodChange(method.crypto_type)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        selectedMethod === method.crypto_type
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className={`crypto-icon mx-auto mb-2 ${method.icon_class || 'bg-muted'}`}>
                        {method.crypto_type.charAt(0)}
                      </div>
                      <p className="text-sm font-medium">{method.crypto_type}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="usd-amount">Amount (USD)</Label>
                  {pricesLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Input
                  id="usd-amount"
                  type="number"
                  placeholder="0.00"
                  value={usdAmount}
                  onChange={(e) => handleUsdChange(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="crypto-amount">
                    Amount ({selectedMethod})
                  </Label>
                  {selectedMethod && prices[selectedMethod] && (
                    <span className="text-xs text-muted-foreground">
                      1 {selectedMethod} = ${prices[selectedMethod].toLocaleString()}
                    </span>
                  )}
                </div>
                <Input
                  id="crypto-amount"
                  type="number"
                  placeholder="0.00000000"
                  value={cryptoAmount}
                  onChange={(e) => handleCryptoChange(e.target.value)}
                  className="h-12 text-lg"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('plan')} className="flex-1">
                  Back
                </Button>
                <Button 
                  className="flex-1 gap-2" 
                  onClick={() => setStep('payment')}
                  disabled={!usdAmount || !canProceedToPayment()}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              {usdAmount && !canProceedToPayment() && (
                <p className="text-sm text-destructive text-center">
                  Total after deposit (${(currentBalance + parseFloat(usdAmount)).toLocaleString()}) 
                  must be at least ${minRequired.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 'payment' && selectedPaymentMethod && (
            <div className="space-y-4">
              <div className="rounded-xl bg-success/10 border border-success/20 p-4">
                <p className="text-sm text-muted-foreground mb-1">You are depositing</p>
                <p className="text-2xl font-bold text-foreground">
                  {cryptoAmount} {selectedMethod}
                </p>
                <p className="text-sm text-muted-foreground">≈ ${parseFloat(usdAmount).toLocaleString()}</p>
              </div>

              {/* Wallet Address */}
              <div className="space-y-2">
                <Label>Send {selectedMethod} to this address</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                  <code className="flex-1 text-sm break-all">{selectedPaymentMethod.wallet_address}</code>
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Proof Image Upload */}
              <div className="space-y-2">
                <Label>Transaction Proof Image <span className="text-destructive">*</span></Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img 
                      src={previewUrl} 
                      alt="Transaction proof" 
                      className="w-full h-40 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors bg-muted/30"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Click to upload transaction screenshot</p>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('amount')} className="flex-1">
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={isLoading || !proofImage}
                >
                  {isLoading ? 'Submitting...' : 'Submit Deposit'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}