import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Calendar } from 'lucide-react';
import { useAudits } from '@/hooks/useAudits';
import { AUDIT_TYPE_LABELS } from '@/lib/constants';
import { AuditType } from '@/types/audit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const AUDIT_TYPES: AuditType[] = ['initial', 'surveillance', 'recertification', 'six-month', 'internal', 'training'];

export const AuditYearStatsCard = () => {
  const { data: dbAudits = [], isLoading } = useAudits();
  const [viewMode, setViewMode] = useState<'calendar' | 'rolling'>('calendar');

  const stats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let label: string;

    if (viewMode === 'calendar') {
      const currentYear = now.getFullYear();
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31, 23, 59, 59);
      label = `Kalenderjahr ${currentYear}`;
    } else {
      startDate = startOfMonth(now);
      endDate = endOfMonth(addMonths(now, 11));
      label = "Kommende 12 Monate";
    }

    const filteredAudits = dbAudits.filter(audit => {
      if (audit.clients?.is_active === false) return false;
      const date = new Date(audit.scheduled_date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });

    const total = filteredAudits.length;
    const byType: Record<string, number> = {};
    for (const type of AUDIT_TYPES) {
      byType[type] = filteredAudits.filter(a => a.type === type).length;
    }

    return { total, byType, label };
  }, [dbAudits, viewMode]);

  if (isLoading) return null;

  return (
    <Card className="flex flex-col h-full border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-card">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-start justify-between gap-3 text-[15px]">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </span>
            Audits
          </span>
          <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-violet-700">{stats.total}</span>
        </CardTitle>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{stats.label}</p>
          <Select value={viewMode} onValueChange={(val: 'calendar' | 'rolling') => setViewMode(val)}>
            <SelectTrigger className="h-7 w-[148px] text-xs" aria-label="Zeitraum">
              <Calendar className="h-3 w-3 mr-1 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar" className="text-xs">Aktuelles Jahr</SelectItem>
              <SelectItem value="rolling" className="text-xs">Rollend (12M)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 flex-1">
        <div className="space-y-2 mt-1">
          {AUDIT_TYPES.map(type => (
            <div key={type} className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground truncate mr-2">{AUDIT_TYPE_LABELS[type]}</span>
              <span className="font-medium tabular-nums">{stats.byType[type]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
