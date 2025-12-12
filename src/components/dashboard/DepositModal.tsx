import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';

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

  const copyAddress = () => {
    navigator.clipboard.writeText(selectedCrypto.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('deposits').insert({
        user_id: user?.id,
        amount: parseFloat(amount),
        crypto_type: selectedCrypto.id,
        crypto_amount: parseFloat(amount),
        wallet_address: selectedCrypto.address,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Deposit initiated! Awaiting admin confirmation.');
      onOpenChange(false);
      setAmount('');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Deposit</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                      ? 'border-primary bg-primary/5'
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
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <code className="flex-1 text-sm break-all">{selectedCrypto.address}</code>
              <Button variant="ghost" size="icon" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              After sending, click submit. Admin will confirm your deposit.
            </p>
          </div>

          <Button
            variant="hero"
            className="w-full"
            onClick={handleSubmit}
            disabled={isLoading || !amount}
          >
            {isLoading ? 'Submitting...' : 'Submit Deposit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
