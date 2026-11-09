import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudits } from '@/hooks/useAudits';
import { useAllAuditTasks, DbAuditTaskFull } from '@/hooks/useAuditTasks';
import { transformAuditToLocal } from '@/lib/auditUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Download, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isAfter, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportAllAuditsToCalendar } from '@/lib/calendarExport';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { OutlookIntegration } from '@/components/OutlookIntegration';

const CalendarSkeleton = () => (
  <Card className="lg:col-span-2">
    <CardHeader>
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {[...Array(35)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </CardContent>
  </Card>
);

const Calendar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const userName = user?.user_metadata?.full_name || user?.email || 'Unbekannt';

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const { data: dbAudits = [], isLoading, error } = useAudits();
  const { data: allTasks = [] } = useAllAuditTasks();

  const audits = useMemo(() =>
    dbAudits.map(audit => transformAuditToLocal(audit)),
    [dbAudits]
  );

  // Get finding deadlines (category = 'finding', not completed)
  const findingDeadlines = useMemo(() => {
    return (allTasks as DbAuditTaskFull[])
      .filter(t => t.category === 'finding' && t.status !== 'completed')
      .map(t => ({
        id: t.id,
        title: t.title,
        dueDate: new Date(t.due_date),
        auditId: t.audit_id,
        clientName: t.audits?.clients?.name || 'Unbekannt',
        severity: t.severity,
      }));
  }, [allTasks]);

  const { daysInMonth, startDayOffset } = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const dayOfWeek = start.getDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return {
      daysInMonth: eachDayOfInterval({ start, end }),
      startDayOffset: offset,
    };
  }, [currentDate]);

  const getAuditsForDay = useCallback((day: Date) => {
    return audits.filter(audit => isSameDay(audit.scheduledDate, day));
  }, [audits]);

  const getFindingsForDay = useCallback((day: Date) => {
    return findingDeadlines.filter(f => isSameDay(f.dueDate, day));
  }, [findingDeadlines]);

  const handleExportAll = useCallback(() => {
    exportAllAuditsToCalendar(audits);
    toast.success('ICS-Datei wurde heruntergeladen.');
  }, [audits]);

  // Active audits within the next 12 months for Outlook sync
  const activeAudits = useMemo(() => {
    const now = new Date();
    const in12Months = addMonths(now, 12);
    return audits.filter(a =>
      (a.status === 'scheduled' || a.status === 'in-progress') &&
      isAfter(a.scheduledDate, now) &&
      isBefore(a.scheduledDate, in12Months)
    );
  }, [audits]);

  const upcomingAudits = useMemo(
    () => activeAudits
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      .slice(0, 5),
    [activeAudits]
  );

  // Upcoming finding deadlines
  const upcomingFindings = useMemo(() => {
    const now = new Date();
    return findingDeadlines
      .filter(f => isAfter(f.dueDate, now) || isSameDay(f.dueDate, now))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);
  }, [findingDeadlines]);

  // Outlook events: audits + finding deadlines
  const outlookEvents = useMemo(() => {
    const auditEvents = activeAudits.map(audit => ({
      id: audit.id,
      clientName: audit.clientName,
      type: audit.type,
      status: audit.status,
      scheduledDate: audit.scheduledDate.toISOString(),
      certifications: audit.certifications,
      notes: audit.notes,
      eventType: 'audit' as const,
      isAllDay: false,
    }));

    const findingEvents = findingDeadlines
      .filter(f => {
        const now = new Date();
        const in12Months = addMonths(now, 12);
        return isAfter(f.dueDate, now) && isBefore(f.dueDate, in12Months);
      })
      .map(f => ({
        id: f.id,
        clientName: f.clientName,
        type: 'finding-deadline',
        status: 'scheduled',
        scheduledDate: f.dueDate.toISOString(),
        certifications: [] as string[],
        notes: `NK-Frist: ${f.title}`,
        eventType: 'audit' as const,
        isAllDay: false,
        title: `⚠️ NK-Frist: ${f.title}`,
      }));

    return [...auditEvents, ...findingEvents];
  }, [activeAudits, findingDeadlines]);

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4">
          <PageHeader
            title="Kalender"
            description={<>Angemeldet als <span className="font-medium text-foreground">{userName}</span></>}
          />
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday} className="px-2 sm:px-3 h-8 sm:h-9 text-sm">
                Heute
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="font-display text-base sm:text-xl font-medium text-foreground">
              {format(currentDate, 'MMMM yyyy', { locale: de })}
            </span>
            <Button size="sm" className="ml-auto" onClick={handleExportAll} disabled={audits.length === 0}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Alle exportieren</span>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Fehler beim Laden der Daten</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Calendar Grid */}
            {isLoading ? (
              <CalendarSkeleton />
            ) : (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Monatsübersicht – {format(currentDate, 'MMMM yyyy', { locale: de })}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                      <div key={day} className="eyebrow text-center py-2">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: startDayOffset }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-16 sm:min-h-24 p-1 sm:p-2" />
                    ))}
                    {daysInMonth.map((day) => {
                      const dayAudits = getAuditsForDay(day);
                      const dayFindings = getFindingsForDay(day);
                      const hasEvents = dayAudits.length > 0 || dayFindings.length > 0;
                      const isToday = isSameDay(day, new Date());

                      const handleDayClick = () => {
                        if (dayAudits.length > 0) {
                          navigate(`/audits/${dayAudits[0].id}`);
                        } else if (dayFindings.length > 0) {
                          navigate(`/audits/${dayFindings[0].auditId}`);
                        }
                      };

                      return (
                        <div
                          key={day.toISOString()}
                          onClick={hasEvents ? handleDayClick : undefined}
                          className={cn(
                            'min-h-16 sm:min-h-24 p-1 sm:p-2 border rounded-lg bg-card transition-all',
                            hasEvents ? 'border-border cursor-pointer hover:border-foreground/25 hover:shadow-md' : 'border-border/50',
                            isToday && 'border-primary ring-1 ring-primary'
                          )}
                        >
                          <div className={cn(
                            'text-sm font-medium mb-1',
                            isToday ? 'text-primary' : 'text-foreground',
                            !isSameMonth(day, currentDate) && 'text-muted-foreground'
                          )}>
                            {format(day, 'd')}
                          </div>
                          {dayAudits.map((audit) => (
                            <div
                              key={audit.id}
                              className="text-[10px] sm:text-xs font-medium bg-primary/[0.08] text-primary px-1 sm:px-2 py-0.5 sm:py-1 rounded-md mb-1 truncate"
                            >
                              {audit.clientName}
                            </div>
                          ))}
                          {dayFindings.map((finding) => (
                            <div
                              key={finding.id}
                              className="text-[10px] sm:text-xs bg-warning/10 text-warning border-warning/20 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md mb-1 truncate flex items-center gap-1"
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {finding.clientName}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Outlook Integration */}
              <OutlookIntegration
                auditCount={activeAudits.length}
                audits={outlookEvents}
              />

              {/* Upcoming Audits */}
              <Card>
                <CardHeader>
                  <CardTitle>Anstehende Audits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : upcomingAudits.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Keine anstehenden Audits
                    </p>
                  ) : (
                    upcomingAudits.map((audit) => (
                      <div
                        key={audit.id}
                        className="space-y-2 pb-4 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                        onClick={() => navigate(`/audits/${audit.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium text-sm text-foreground">{audit.clientName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(audit.scheduledDate, 'dd.MM.yyyy')}
                            </div>
                          </div>
                          {audit.certifications.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {audit.certifications[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Upcoming NK Deadlines */}
              {upcomingFindings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      NK-Fristen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {upcomingFindings.map((finding) => (
                      <div
                        key={finding.id}
                        className="space-y-1 pb-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                        onClick={() => navigate(`/audits/${finding.auditId}`)}
                      >
                        <p className="font-medium text-sm text-foreground truncate">{finding.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(finding.dueDate, 'dd.MM.yyyy')}
                          <span>•</span>
                          <span>{finding.clientName}</span>
                        </div>
                        {finding.severity && (
                          <Badge variant="outline" className={cn('text-xs', {
                            'bg-destructive/10 text-destructive border-destructive/20': finding.severity === 'major',
                            'bg-warning/10 text-warning border-warning/20': finding.severity === 'minor',
                            'bg-info/10 text-info border-info/20': finding.severity === 'recommendation',
                          })}>
                            {finding.severity === 'major' ? 'Haupt-NK' : finding.severity === 'minor' ? 'Neben-NK' : 'Empfehlung'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Calendar;
