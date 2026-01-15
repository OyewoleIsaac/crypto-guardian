import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Mail, Phone, Wallet, Camera, Save } from 'lucide-react';

interface Profile {
  full_name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface ProfileSectionProps {
  balance?: number;
  showBalance?: boolean;
}

export function ProfileSection({ balance = 0, showBalance = true }: ProfileSectionProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email, username, phone, avatar_url')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      setProfile(data);
      setFormData({
        full_name: data?.full_name || '',
        username: data?.username || '',
        phone: data?.phone || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          username: formData.username,
          phone: formData.phone,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('Profile updated successfully');
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Avatar updated');
      fetchProfile();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card border border-border p-6 animate-pulse">
        <div className="h-24 w-24 rounded-full bg-muted mx-auto mb-4" />
        <div className="h-6 bg-muted rounded w-1/2 mx-auto mb-2" />
        <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
      </div>
    );
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex flex-col items-center mb-6">
        <div className="relative mb-4">
          <Avatar className="h-24 w-24 border-4 border-primary/20">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </label>
        </div>
        
        <h2 className="font-display text-xl font-bold text-foreground">
          {profile?.full_name || 'User'}
        </h2>
        <p className="text-muted-foreground text-sm">
          {profile?.email || user?.email}
        </p>
      </div>

      {showBalance && (
        <div className="bg-gradient-primary rounded-xl p-4 mb-6 text-center">
          <p className="text-primary-foreground/80 text-sm mb-1">Account Balance</p>
          <p className="text-2xl font-bold text-primary-foreground">
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Choose a username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter phone number"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="font-medium text-foreground">{profile?.username || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="font-medium text-foreground">{profile?.email || user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{profile?.phone || 'Not set'}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-4" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        </div>
      )}
    </div>
  );
}

export { PasswordChangeSection } from './PasswordChangeSection';