import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Check, Upload, Image, X } from 'lucide-react';

const CRYPTO_OPTIONS = [
  { id: 'BTC', name: 'Bitcoin', symbol: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', color: 'crypto-btc' },
  { id: 'USDT', name: 'Tether', symbol: 'USDT', address: 'TXWkP3jLBqRGojUih1ShzNyDaN5Csnebok', color: 'crypto-usdt' },
  { id: 'ADA', name: 'Cardano', symbol: 'ADA', address: 'addr1qx2kd28nq8ac5pr...truncated', color: 'crypto-ada' },
];

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DepositModal({ open, onOpenChange, onSuccess }: DepositModalProps) {
  const { user } = useAuth();
  const [selectedCrypto, setSelectedCrypto] = useState(CRYPTO_OPTIONS[0]);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyAddress = () => {
    navigator.clipboard.writeText(selectedCrypto.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!proofImage) {
      toast.error('Please upload a transaction proof image');
      return;
    }

    setIsLoading(true);
    try {
      // Upload proof image
      const fileExt = proofImage.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('deposit-proofs')
        .upload(fileName, proofImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('deposit-proofs')
        .getPublicUrl(fileName);

      // Create deposit record
      const { error } = await supabase.from('deposits').insert({
        user_id: user?.id,
        amount: parseFloat(amount),
        crypto_type: selectedCrypto.id,
        crypto_amount: parseFloat(amount),
        wallet_address: selectedCrypto.address,
        status: 'pending',
        proof_image_url: publicUrl,
      });

      if (error) throw error;

      toast.success('Deposit initiated! Awaiting admin confirmation.');
      onOpenChange(false);
      setAmount('');
      setProofImage(null);
      setPreviewUrl(null);
      onSuccess();
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Failed to create deposit');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Deposit</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Crypto Selection */}
          <div className="space-y-2">
            <Label>Select Cryptocurrency</Label>
            <div className="grid grid-cols-3 gap-2">
              {CRYPTO_OPTIONS.map((crypto) => (
                <button
                  key={crypto.id}
                  type="button"
                  onClick={() => setSelectedCrypto(crypto)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    selectedCrypto.id === crypto.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`crypto-icon mx-auto mb-2 ${crypto.color}`}>
                    {crypto.symbol.charAt(0)}
                  </div>
                  <p className="text-sm font-medium">{crypto.symbol}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD equivalent)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 text-lg"
            />
          </div>

          {/* Wallet Address */}
          <div className="space-y-2">
            <Label>Send {selectedCrypto.symbol} to this address</Label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
              <code className="flex-1 text-sm break-all">{selectedCrypto.address}</code>
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
            <p className="text-xs text-muted-foreground">
              Upload a screenshot of your transaction confirmation (max 5MB)
            </p>
          </div>

          <Button
            variant="hero"
            className="w-full"
            onClick={handleSubmit}
            disabled={isLoading || !amount || !proofImage}
          >
            {isLoading ? 'Submitting...' : 'Submit Deposit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}