import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
  isLoading: boolean;
}

export function TransactionsList({ transactions, isLoading }: TransactionsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No transactions yet</p>
        <p className="text-sm">Your transaction history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              tx.type === 'deposit' || tx.type === 'credit' 
                ? 'bg-success/10' 
                : 'bg-destructive/10'
            }`}>
              {tx.type === 'deposit' || tx.type === 'credit' ? (
                <ArrowUpRight className="h-5 w-5 text-success" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground capitalize">{tx.type}</p>
              <p className="text-sm text-muted-foreground">
                {tx.description || new Date(tx.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <p className={`font-semibold ${
            tx.type === 'deposit' || tx.type === 'credit' 
              ? 'text-success' 
              : 'text-destructive'
          }`}>
            {tx.type === 'deposit' || tx.type === 'credit' ? '+' : '-'}
            ${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      ))}
    </div>
  );
}
