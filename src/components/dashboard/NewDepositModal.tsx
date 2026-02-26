import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { toast } from 'sonner';
import { Copy, Check, Upload, X, ArrowRight, RefreshCw, AlertCircle, Info } from 'lucide-react';
import {
  parseFinancialAmount,
  parseCryptoAmount,
  validateFinancialInput,
  MAX_FINANCIAL_AMOUNT
} from '@/lib/financial-validation';

interface DepositHint {
  amountNeeded: number;
  planName: string;
}

interface NewDepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  depositHint?: DepositHint;
}

export function NewDepositModal({
  open,
  onOpenChange,
  onSuccess,
  depositHint,
}: NewDepositModalProps) {
  const { user } = useAuth();
  const { enabledMethods, isLoading: methodsLoading } = usePaymentMethods();

  const cryptoSymbols = useMemo(() => enabledMethods.map(m => m.crypto_type), [enabledMethods]);
  const { prices, isLoading: pricesLoading, convertUsdToCrypto, convertCryptoToUsd, refetch: refetchPrices } = useCryptoPrices(cryptoSymbols);

  const [step, setStep] = useState<'amount' | 'payment'>('amount');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [usdAmount, setUsdAmount] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first enabled method
  useEffect(() => {
    if (enabledMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0].crypto_type);
    }
  }, [enabledMethods, selectedMethod]);

  const selectedPaymentMethod = enabledMethods.find(m => m.crypto_type === selectedMethod);

  // Handle USD amount change with validation
  const handleUsdChange = (value: string) => {
    // Allow empty or valid numeric input
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setUsdAmount(value);
      if (value && selectedMethod) {
        const parsed = parseFinancialAmount(value);
        if (parsed !== null) {
          const crypto = convertUsdToCrypto(parsed, selectedMethod);
          setCryptoAmount(crypto > 0 ? crypto.toFixed(8) : '');
        }
      } else {
        setCryptoAmount('');
      }
    }
  };

  // Handle crypto amount change with validation
  const handleCryptoChange = (value: string) => {
    // Allow empty or valid crypto format (up to 8 decimals)
    if (value === '' || /^\d*\.?\d{0,8}$/.test(value)) {
      setCryptoAmount(value);
      if (value && selectedMethod) {
        const parsed = parseCryptoAmount(value);
        if (parsed !== null) {
          const usd = convertCryptoToUsd(parsed, selectedMethod);
          setUsdAmount(usd > 0 ? usd.toFixed(2) : '');
        }
      } else {
        setUsdAmount('');
      }
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
    // Validate USD amount using financial validation
    const validationError = validateFinancialInput(usdAmount);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    const parsedUsdAmount = parseFinancialAmount(usdAmount);
    const parsedCryptoAmount = parseCryptoAmount(cryptoAmount);
    
    if (parsedUsdAmount === null) {
      toast.error('Invalid USD amount');
      return;
    }
    
    if (parsedCryptoAmount === null) {
      toast.error('Invalid crypto amount');
      return;
    }

    if (!proofImage) {
      toast.error('Please upload a transaction proof image');
      return;
    }

    if (!selectedMethod || !selectedPaymentMethod) {
      toast.error('Please select a payment method');
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

      // Create deposit record with validated amounts
      const { error } = await supabase.from('deposits').insert({
        user_id: user?.id,
        amount: parsedUsdAmount,
        usd_amount: parsedUsdAmount,
        crypto_type: selectedMethod,
        crypto_amount: parsedCryptoAmount,
        conversion_rate: prices[selectedMethod] || 0,
        wallet_address: selectedPaymentMethod.wallet_address,
        status: 'pending',
        proof_image_url: publicUrl,
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
    setStep('amount');
    setSelectedMethod(enabledMethods[0]?.crypto_type || null);
    setUsdAmount('');
    setCryptoAmount('');
    setProofImage(null);
    setPreviewUrl(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Deposit</DialogTitle>
        </DialogHeader>

        {/* Steps Indicator */}
        <div className="flex items-center gap-2 mb-4">
          {['amount', 'payment'].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : i < ['amount', 'payment'].indexOf(step)
                  ? 'bg-success text-success-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              {i < 1 && <div className="h-0.5 flex-1 bg-border mx-2" />}
            </div>
          ))}
        </div>

        <div className="space-y-5 py-4">
          {/* Step 1: Enter Amount */}
          {step === 'amount' && (
            <div className="space-y-4">
              {/* Deposit hint from insufficient balance flow */}
              {depositHint && (
                <div className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3">
                  <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    To activate the <strong>{depositHint.planName}</strong> plan, deposit at least{' '}
                    <strong className="text-primary">${depositHint.amountNeeded.toLocaleString()}</strong>.
                    Once your deposit is approved, return to <strong>Investment Plans</strong> to start investing.
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
                      {method.network && (
                        <p className="text-xs text-muted-foreground mt-1">{method.network}</p>
                      )}
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

              <Button
                className="w-full gap-2"
                onClick={() => setStep('payment')}
                disabled={!usdAmount}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Payment */}
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
                <div className="flex items-center justify-between">
                  <Label>Send {selectedMethod} to this address</Label>
                  {selectedPaymentMethod.network && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/10 text-warning">
                      Network: {selectedPaymentMethod.network}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                  <code className="flex-1 text-sm break-all">{selectedPaymentMethod.wallet_address}</code>
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {selectedPaymentMethod.network && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Make sure to send using the {selectedPaymentMethod.network} network only!
                  </p>
                )}
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