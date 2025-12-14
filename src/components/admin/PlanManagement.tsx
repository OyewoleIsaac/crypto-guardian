import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useInvestmentPlans, InvestmentPlan } from '@/hooks/useInvestmentPlans';

export function PlanManagement() {
  const { plans, isLoading, refetch } = useInvestmentPlans();
  const [editPlan, setEditPlan] = useState<InvestmentPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    min_investment: 100,
    max_investment: null as number | null,
    roi_percentage: 10,
    duration_days: 30,
    features: '',
    is_active: true,
  });

  const openCreateDialog = () => {
    setEditPlan(null);
    setFormData({
      name: '', description: '', min_investment: 100, max_investment: null,
      roi_percentage: 10, duration_days: 30, features: '', is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan: InvestmentPlan) => {
    setEditPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      min_investment: plan.min_investment,
      max_investment: plan.max_investment,
      roi_percentage: plan.roi_percentage,
      duration_days: plan.duration_days,
      features: plan.features.join(', '),
      is_active: plan.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const planData = {
        name: formData.name,
        description: formData.description || null,
        min_investment: formData.min_investment,
        max_investment: formData.max_investment,
        roi_percentage: formData.roi_percentage,
        duration_days: formData.duration_days,
        features: formData.features.split(',').map(f => f.trim()).filter(Boolean),
        is_active: formData.is_active,
      };

      if (editPlan) {
        const { error } = await supabase.from('investment_plans').update(planData).eq('id', editPlan.id);
        if (error) throw error;
        toast.success('Plan updated');
      } else {
        const { error } = await supabase.from('investment_plans').insert(planData);
        if (error) throw error;
        toast.success('Plan created');
      }
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      toast.error('Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Investment Plans</h2>
        <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" /> Add Plan</Button>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center justify-between p-4 rounded-xl border bg-card">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{plan.name}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${plan.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Min: ${plan.min_investment} | ROI: {plan.roi_percentage}% | {plan.duration_days} days
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>ROI %</Label><Input type="number" value={formData.roi_percentage} onChange={(e) => setFormData(p => ({ ...p, roi_percentage: +e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Min Investment</Label><Input type="number" value={formData.min_investment} onChange={(e) => setFormData(p => ({ ...p, min_investment: +e.target.value }))} /></div>
              <div><Label>Max Investment</Label><Input type="number" value={formData.max_investment || ''} onChange={(e) => setFormData(p => ({ ...p, max_investment: e.target.value ? +e.target.value : null }))} /></div>
            </div>
            <div><Label>Duration (days)</Label><Input type="number" value={formData.duration_days} onChange={(e) => setFormData(p => ({ ...p, duration_days: +e.target.value }))} /></div>
            <div><Label>Features (comma-separated)</Label><Input value={formData.features} onChange={(e) => setFormData(p => ({ ...p, features: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={formData.is_active} onCheckedChange={(c) => setFormData(p => ({ ...p, is_active: c }))} /><Label>Active</Label></div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}