import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { usePaymentMethods, PaymentMethod } from '@/hooks/usePaymentMethods';

export function PaymentMethodsManagement() {
  const { methods, isLoading, refetch } = usePaymentMethods();
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ wallet_address: '', is_enabled: true, network: '' });

  const openEditDialog = (method: PaymentMethod) => {
    setEditMethod(method);
    setFormData({ wallet_address: method.wallet_address, is_enabled: method.is_enabled, network: method.network || '' });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editMethod) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('payment_methods').update(formData).eq('id', editMethod.id);
      if (error) throw error;
      toast.success('Payment method updated');
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold">Payment Methods</h2>
      <div className="space-y-3">
        {methods.map((method) => (
          <div key={method.id} className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{method.crypto_name} ({method.crypto_type})</span>
                {method.network && (
                  <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                    {method.network}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs ${method.is_enabled ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {method.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-mono truncate max-w-md">{method.wallet_address}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(method)}><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editMethod?.crypto_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Wallet Address</Label>
              <Input value={formData.wallet_address} onChange={(e) => setFormData(p => ({ ...p, wallet_address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Network (e.g., TRC-20, ERC-20, Bitcoin Mainnet)</Label>
              <Input 
                value={formData.network} 
                onChange={(e) => setFormData(p => ({ ...p, network: e.target.value }))} 
                placeholder="e.g., Tron Network (TRC-20)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_enabled} onCheckedChange={(c) => setFormData(p => ({ ...p, is_enabled: c }))} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}