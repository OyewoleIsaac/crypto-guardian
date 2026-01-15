import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'deposit' | 'investment' | 'withdrawal' | 'balance' | 'security';
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedData = (data || []) as Notification[];
      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}

// DEPRECATED: Notifications and audit logs are now created automatically via database triggers
// These functions are kept for backwards compatibility but will be removed in a future update
// The database triggers (on_deposit_status_change, on_withdrawal_status_change, etc.) now handle
// automatic notification and audit log creation when deposit/withdrawal status changes occur.

/**
 * @deprecated Use database triggers instead. This function is kept for admin-only use cases
 * where direct notification insertion is needed and the user has admin role.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string = 'info',
  metadata: Record<string, unknown> = {}
) {
  // Note: This will only work for users with admin role due to RLS policies
  const { error } = await supabase.from('notifications').insert([{
    user_id: userId,
    title,
    message,
    type,
    metadata: metadata as unknown as Record<string, never>,
  }]);

  if (error) {
    // Log error but don't throw - notifications are now primarily trigger-based
    console.warn('Direct notification insert failed (may require admin role):', error);
  }
}

/**
 * @deprecated Use database triggers instead. Audit logs are now created automatically
 * via database triggers when significant actions occur.
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
  performedBy?: string
) {
  // Note: This will work for the user's own actions or for admins due to RLS policies
  const { error } = await supabase.from('audit_logs').insert([{
    user_id: userId,
    action,
    details: details as unknown as Record<string, never>,
    performed_by: performedBy,
  }]);

  if (error) {
    // Log error but don't throw - audit logs are now primarily trigger-based
    console.warn('Direct audit log insert failed:', error);
  }
}
