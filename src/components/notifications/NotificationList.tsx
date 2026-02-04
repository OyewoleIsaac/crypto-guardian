import { 
  Bell, 
  CheckCheck, 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  Shield, 
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  deposit: DollarSign,
  investment: TrendingUp,
  withdrawal: Wallet,
  balance: DollarSign,
  security: Shield,
};

const typeColors: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-500',
  success: 'bg-green-500/10 text-green-500',
  warning: 'bg-amber-500/10 text-amber-500',
  error: 'bg-red-500/10 text-red-500',
  deposit: 'bg-primary/10 text-primary',
  investment: 'bg-emerald-500/10 text-emerald-500',
  withdrawal: 'bg-violet-500/10 text-violet-500',
  balance: 'bg-cyan-500/10 text-cyan-500',
  security: 'bg-orange-500/10 text-orange-500',
};

export function NotificationList({
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationListProps) {
  const unreadNotifications = notifications.filter(n => !n.is_read);
  // Show only unread notifications in the list - read notifications are hidden
  const visibleNotifications = unreadNotifications;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Notifications</h3>
        {unreadNotifications.length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onMarkAllAsRead}>
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <ScrollArea className="h-[300px]">
        {visibleNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No new notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleNotifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Info;
              const colorClass = typeColors[notification.type] || typeColors.info;

              return (
                <div
                  key={notification.id}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer bg-primary/5"
                  onClick={() => {
                    onMarkAsRead(notification.id);
                  }}
                >
                  <div className="flex gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground">
                          {notification.title}
                        </p>
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
