import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wallet } from 'lucide-react';

interface InsufficientBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredAmount: number;
  currentBalance: number;
  planName: string;
  onDeposit: () => void;
}

export function InsufficientBalanceModal({
  open,
  onOpenChange,
  requiredAmount,
  currentBalance,
  planName,
  onDeposit,
}: InsufficientBalanceModalProps) {
  const amountNeeded = requiredAmount - currentBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <DialogTitle className="font-display text-xl">Insufficient Balance</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            You do not have sufficient balance to activate the <strong>{planName}</strong> plan.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Required</p>
              <p className="text-xl font-bold text-foreground">
                ${requiredAmount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
              <p className="text-xl font-bold text-foreground">
                ${currentBalance.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-center">
              You need an additional <strong className="text-destructive">${amountNeeded.toLocaleString()}</strong> to activate this plan.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onOpenChange(false);
              onDeposit();
            }} 
            className="flex-1 gap-2"
          >
            <Wallet className="h-4 w-4" />
            Top Up Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}