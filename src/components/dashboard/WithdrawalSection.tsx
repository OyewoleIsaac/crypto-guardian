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
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Trash2,
  Plus,
  BookMarked,
  Check,
} from 'lucide-react';
import { useWithdrawals, WithdrawalEligibility } from '@/hooks/useWithdrawals';
import { useWithdrawalMethods, WithdrawalMethod } from '@/hooks/useWithdrawalMethods';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { format } from 'date-fns';
import {
  parseFinancialAmount,
  validateFinancialInput,
} from '@/lib/financial-validation';

interface WithdrawalSectionProps {
  onSuccess?: () => void;
}

export function WithdrawalSection({ onSuccess }: WithdrawalSectionProps = {}) {
  const {
    withdrawals,
    isLoading,
    checkEligibility,
    submitWithdrawal,
    refetch,
  } = useWithdrawals();

  const {
    methods: savedMethods,
    isLoading: methodsLoading,
    saveMethod,
    deleteMethod,
    refetch: refetchMethods,
  } = useWithdrawalMethods();

  const { enabledMethods } = usePaymentMethods();

  // ── Eligibility ──────────────────────────────────────────────────────────
  const [eligibility, setEligibility] = useState<WithdrawalEligibility | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);

  // ── Request-withdrawal dialog ─────────────────────────────────────────────
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  // null = "enter new address", otherwise the saved method id selected
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<WithdrawalMethod | null>(null);
  // When entering a new address
  const [newCryptoType, setNewCryptoType] = useState<string>('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [saveThisMethod, setSaveThisMethod] = useState(false);
  const [methodLabel, setMethodLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Add-saved-method dialog ───────────────────────────────────────────────
  const [addMethodDialogOpen, setAddMethodDialogOpen] = useState(false);
  const [addCryptoType, setAddCryptoType] = useState('');
  const [addWalletAddress, setAddWalletAddress] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Delete confirmation ───────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeCryptoType = selectedSavedMethod
    ? selectedSavedMethod.crypto_type
    : newCryptoType;

  const activeWallet = selectedSavedMethod
    ? selectedSavedMethod.wallet_address
    : newWalletAddress;

  const activeNetwork = selectedSavedMethod
    ? savedMethods.find(m => m.id === selectedSavedMethod.id)?.network ?? null
    : enabledMethods.find(m => m.crypto_type === newCryptoType)?.network ?? null;

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsCheckingEligibility(true);
      try {
        setEligibility(await checkEligibility());
      } finally {
        setIsCheckingEligibility(false);
      }
    })();
  }, [checkEligibility]);

  // Auto-select first crypto when dialog opens with no saved method
  useEffect(() => {
    if (withdrawDialogOpen && !selectedSavedMethod && !newCryptoType && enabledMethods.length > 0) {
      setNewCryptoType(enabledMethods[0].crypto_type);
    }
  }, [withdrawDialogOpen, selectedSavedMethod, newCryptoType, enabledMethods]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const resetWithdrawDialog = () => {
    setSelectedSavedMethod(null);
    setNewCryptoType(enabledMethods[0]?.crypto_type || '');
    setNewWalletAddress('');
    setSaveThisMethod(false);
    setMethodLabel('');
    setAmount('');
  };

  const handleWithdrawDialogOpenChange = (open: boolean) => {
    setWithdrawDialogOpen(open);
    if (!open) resetWithdrawDialog();
  };

  const handleSelectSavedMethod = (method: WithdrawalMethod) => {
    setSelectedSavedMethod(method);
    setNewWalletAddress('');
    setSaveThisMethod(false);
    setMethodLabel('');
  };

  const handleUseNewAddress = () => {
    setSelectedSavedMethod(null);
    setNewCryptoType(enabledMethods[0]?.crypto_type || '');
    setNewWalletAddress('');
    setSaveThisMethod(false);
    setMethodLabel('');
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateFinancialInput(amount);
    if (validationError) { toast.error(validationError); return; }

    const numAmount = parseFinancialAmount(amount);
    if (numAmount === null) { toast.error('Invalid amount format'); return; }

    if (!activeCryptoType) { toast.error('Please select a withdrawal method'); return; }
    if (!activeWallet.trim()) { toast.error('Please enter a wallet address'); return; }

    setIsSubmitting(true);
    try {
      // Save method first if requested
      if (saveThisMethod && !selectedSavedMethod) {
        try {
          await saveMethod(newCryptoType, newWalletAddress.trim(), activeNetwork, methodLabel.trim() || null);
          toast.success('Withdrawal method saved for future use.');
        } catch (saveErr: any) {
          // Duplicate warning — don't block the withdrawal
          toast.warning(saveErr.message || 'Could not save method, but withdrawal will proceed.');
        }
      }

      await submitWithdrawal(numAmount, activeWallet.trim(), activeCryptoType, activeNetwork);
      toast.success('Withdrawal request submitted! Awaiting admin approval.');
      setWithdrawDialogOpen(false);
      resetWithdrawDialog();

      const newEligibility = await checkEligibility();
      setEligibility(newEligibility);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNewMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCryptoType) { toast.error('Please select a cryptocurrency'); return; }
    if (!addWalletAddress.trim()) { toast.error('Please enter a wallet address'); return; }

    setIsSaving(true);
    try {
      const network = enabledMethods.find(m => m.crypto_type === addCryptoType)?.network ?? null;
      await saveMethod(addCryptoType, addWalletAddress.trim(), network, addLabel.trim() || null);
      toast.success('Withdrawal method saved.');
      setAddMethodDialogOpen(false);
      setAddCryptoType('');
      setAddWalletAddress('');
      setAddLabel('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save method');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMethod = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMethod(id);
      toast.success('Method removed.');
      // If it was selected for withdrawal, clear selection
      if (selectedSavedMethod?.id === id) setSelectedSavedMethod(null);
    } catch {
      toast.error('Failed to remove method');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isCheckingEligibility) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Eligibility Status Card ────────────────────────────────────────── */}
      <Card className={`p-6 border-2 ${
        eligibility?.canWithdraw
          ? 'border-success/30 bg-success/5'
          : 'border-warning/30 bg-warning/5'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`p-3 rounded-xl self-start ${
            eligibility?.canWithdraw ? 'bg-success/10' : 'bg-warning/10'
          }`}>
            {eligibility?.canWithdraw
              ? <CheckCircle className="h-6 w-6 text-success" />
              : <AlertTriangle className="h-6 w-6 text-warning" />
            }
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              {eligibility?.canWithdraw ? 'Eligible for Withdrawal' : 'Withdrawal Not Available'}
            </h3>
            <p className="text-muted-foreground text-sm mb-2">{eligibility?.reason}</p>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>
                Available:{' '}
                <strong className="text-foreground">
                  ${eligibility?.availableBalance?.toFixed(2) || '0.00'}
                </strong>
              </span>
            </div>
          </div>

          {/* Request Withdrawal dialog trigger */}
          <Dialog open={withdrawDialogOpen} onOpenChange={handleWithdrawDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="hero" disabled={!eligibility?.canWithdraw} className="shrink-0">
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Request Withdrawal
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Request Withdrawal</DialogTitle>
                <DialogDescription>
                  Select a saved method or enter a new wallet address, then specify the amount.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmitWithdrawal} className="space-y-5 py-2">

                {/* ── Saved methods ─────────────────────────────────────── */}
                {savedMethods.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Saved Methods</Label>
                    <div className="grid gap-2">
                      {savedMethods.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectSavedMethod(m)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                            selectedSavedMethod?.id === m.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              selectedSavedMethod?.id === m.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {m.crypto_type.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm">
                                {m.crypto_type}
                                {m.network && (
                                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                                    ({m.network})
                                  </span>
                                )}
                              </p>
                              {m.label && (
                                <p className="text-xs text-primary font-medium">{m.label}</p>
                              )}
                              <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                                {m.wallet_address}
                              </p>
                            </div>
                          </div>
                          {selectedSavedMethod?.id === m.id && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Option to use a different address */}
                    <button
                      type="button"
                      onClick={handleUseNewAddress}
                      className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 border-dashed text-sm transition-all ${
                        !selectedSavedMethod
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      Use a different address
                    </button>
                  </div>
                )}

                {/* ── New-address fields (shown when no saved method selected) ── */}
                {!selectedSavedMethod && (
                  <>
                    <div className="space-y-2">
                      <Label>Select Cryptocurrency</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {enabledMethods.map(pm => (
                          <button
                            key={pm.crypto_type}
                            type="button"
                            onClick={() => setNewCryptoType(pm.crypto_type)}
                            className={`p-3 rounded-xl border-2 text-center transition-all ${
                              newCryptoType === pm.crypto_type
                                ? 'border-primary bg-primary/5 shadow-sm'
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
                    </div>

                    {newCryptoType && (
                      <div className="space-y-2">
                        <Label htmlFor="wallet-address">
                          {newCryptoType} Wallet Address
                          {activeNetwork && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({activeNetwork})
                            </span>
                          )}
                        </Label>
                        <Input
                          id="wallet-address"
                          type="text"
                          placeholder={`Enter your ${newCryptoType} wallet address`}
                          value={newWalletAddress}
                          onChange={e => setNewWalletAddress(e.target.value)}
                          required
                        />
                        {activeNetwork && (
                          <p className="text-xs text-warning flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Use only the {activeNetwork} network to avoid loss of funds.
                          </p>
                        )}

                        {/* Save method option */}
                        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 mt-1">
                          <input
                            type="checkbox"
                            id="save-method"
                            checked={saveThisMethod}
                            onChange={e => setSaveThisMethod(e.target.checked)}
                            className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                          />
                          <div className="flex-1">
                            <label htmlFor="save-method" className="text-sm font-medium cursor-pointer">
                              Save this method for future withdrawals
                            </label>
                            {saveThisMethod && (
                              <Input
                                type="text"
                                placeholder="Optional label (e.g. My BTC Wallet)"
                                value={methodLabel}
                                onChange={e => setMethodLabel(e.target.value)}
                                className="mt-2 h-8 text-sm"
                                maxLength={50}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── Selected saved method preview ─────────────────────── */}
                {selectedSavedMethod && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 text-sm space-y-1">
                    <p className="text-muted-foreground">Sending to</p>
                    <p className="font-semibold">
                      {selectedSavedMethod.crypto_type}
                      {selectedSavedMethod.network && (
                        <span className="font-normal text-muted-foreground ml-1">
                          ({selectedSavedMethod.network})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {selectedSavedMethod.wallet_address}
                    </p>
                  </div>
                )}

                {/* ── Amount ───────────────────────────────────────────── */}
                {(selectedSavedMethod || newCryptoType) && (
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-amount">Amount (USD)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="withdraw-amount"
                        type="number"
                        step="0.01"
                        min="1"
                        max={eligibility?.availableBalance || 0}
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Available: ${eligibility?.availableBalance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWithdrawDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !activeCryptoType ||
                      (!selectedSavedMethod && !newWalletAddress.trim()) ||
                      !amount
                    }
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit Request'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* ── Saved Withdrawal Methods ──────────────────────────────────────── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Saved Withdrawal Methods</h3>
              <p className="text-xs text-muted-foreground">
                Pre-save wallet addresses for faster withdrawals
              </p>
            </div>
          </div>

          {/* Add new saved method dialog */}
          <Dialog open={addMethodDialogOpen} onOpenChange={setAddMethodDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Method
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Withdrawal Method</DialogTitle>
                <DialogDescription>
                  Save a wallet address so you can select it quickly next time.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveNewMethod} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Cryptocurrency</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {enabledMethods.map(pm => (
                      <button
                        key={pm.crypto_type}
                        type="button"
                        onClick={() => setAddCryptoType(pm.crypto_type)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          addCryptoType === pm.crypto_type
                            ? 'border-primary bg-primary/5 shadow-sm'
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
                </div>

                {addCryptoType && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="add-wallet">
                        {addCryptoType} Wallet Address
                      </Label>
                      <Input
                        id="add-wallet"
                        type="text"
                        placeholder={`Enter your ${addCryptoType} address`}
                        value={addWalletAddress}
                        onChange={e => setAddWalletAddress(e.target.value)}
                        required
                      />
                      {enabledMethods.find(m => m.crypto_type === addCryptoType)?.network && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Use the {enabledMethods.find(m => m.crypto_type === addCryptoType)?.network} network.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="add-label">
                        Label <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="add-label"
                        type="text"
                        placeholder="e.g. My Main Wallet, Binance Account…"
                        value={addLabel}
                        onChange={e => setAddLabel(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                  </>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddMethodDialogOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving || !addCryptoType || !addWalletAddress.trim()}>
                    {isSaving ? 'Saving…' : 'Save Method'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {methodsLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : savedMethods.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No saved methods yet.</p>
            <p className="text-xs mt-1">
              Click <strong>Add Method</strong> or save one during your next withdrawal.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedMethods.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-sm text-primary flex-shrink-0">
                    {m.crypto_type.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">
                      {m.crypto_type}
                      {m.network && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({m.network})
                        </span>
                      )}
                      {m.label && (
                        <span className="ml-2 text-xs text-primary font-medium">
                          {m.label}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                      {m.wallet_address}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDeleteMethod(m.id)}
                  disabled={deletingId === m.id}
                  title="Remove"
                >
                  {deletingId === m.id
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Withdrawal History ────────────────────────────────────────────── */}
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
            {[1, 2, 3].map(i => (
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
            {withdrawals.map(w => (
              <div
                key={w.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ArrowDownToLine className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      ${w.amount.toFixed(2)} {w.crypto_type}
                    </p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {w.wallet_address}
                    </p>
                    {w.status === 'rejected' && w.admin_notes && (
                      <p className="text-xs text-destructive mt-0.5">
                        Reason: {w.admin_notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(w.status)}
                  <p className="text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {format(new Date(w.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Pending notice ─────────────────────────────────────────────────── */}
      {withdrawals.some(w => w.status === 'pending') && (
        <Card className="p-4 bg-warning/5 border-warning/30">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Pending Withdrawal</p>
              <p className="text-muted-foreground">
                Your funds are held until the admin approves your request. Processing typically
                takes 1–3 hours; in some cases up to 3 business days.
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
              <li>Your balance is deducted only when your withdrawal request is <strong>approved</strong></li>
              <li>If your request is rejected, no funds are moved and you are notified</li>
              <li>Use the exact same network as the selected cryptocurrency (e.g. TRC-20 for USDT)</li>
              <li>Ensure your wallet address is correct — transactions cannot be reversed</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
