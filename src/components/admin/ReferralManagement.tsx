import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAdminReferrals } from '@/hooks/useReferrals';
import { Users, Search, RefreshCw, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function ReferralManagement() {
  const { referrals, isLoading } = useAdminReferrals();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReferrals = referrals.filter((ref) => {
    const search = searchTerm.toLowerCase();
    return (
      ref.referrer?.full_name?.toLowerCase().includes(search) ||
      ref.referrer?.email?.toLowerCase().includes(search) ||
      ref.referred?.full_name?.toLowerCase().includes(search) ||
      ref.referred?.email?.toLowerCase().includes(search)
    );
  });

  // Calculate referral counts per user
  const referralCounts = referrals.reduce((acc, ref) => {
    const referrerId = ref.referrer_id;
    acc[referrerId] = (acc[referrerId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get top referrers
  const topReferrers = Object.entries(referralCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referrals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(referralCounts).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {referrals.filter(r => {
                const date = new Date(r.created_at);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Referrers */}
      {topReferrers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topReferrers.map(([referrerId, count], index) => {
                const referrer = referrals.find(r => r.referrer_id === referrerId)?.referrer;
                return (
                  <div key={referrerId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>#{index + 1}</Badge>
                      <div>
                        <p className="font-medium">{referrer?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{referrer?.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{count as number} referrals</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Referrals</CardTitle>
          <CardDescription>Complete list of referral relationships</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredReferrals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchTerm ? 'No referrals match your search' : 'No referrals yet'}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Referred User</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ref.referrer?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{ref.referrer?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ref.referred?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{ref.referred?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(ref.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
