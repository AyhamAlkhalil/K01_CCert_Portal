import { useActivityLog } from '@/hooks/useActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { History, User, Search, FileCheck, Users, Award, Building2, UserCheck, MessageSquare } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';

const ACTION_LABELS: Record<string, string> = {
  created: 'Erstellt',
  updated: 'Bearbeitet',
  deleted: 'Gelöscht',
  status_changed: 'Status geändert',
  imported: 'Importiert',
};

const ENTITY_LABELS: Record<string, string> = {
  client: 'Kunde',
  audit: 'Audit',
  certification: 'Zertifizierung',
  contact: 'Kontakt',
  auditor: 'Auditor',
  certification_body: 'Zertifizierer',
  audit_task: 'Audit-Aufgabe',
  client_certification: 'Kunden-Zertifizierung',
};

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  client: Users,
  audit: FileCheck,
  certification: Award,
  contact: MessageSquare,
  auditor: UserCheck,
  certification_body: Building2,
  client_certification: Award,
  audit_task: FileCheck,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-success/10 text-success border-success/20',
  updated: 'bg-info/10 text-info border-info/20',
  deleted: 'bg-destructive/10 text-destructive border-destructive/20',
  status_changed: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
  imported: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
};

const getEntityLink = (entityType: string, entityId: string | null, details?: Record<string, unknown> | null): string | null => {
  if (!entityId) return null;
  switch (entityType) {
    case 'client': return `/clients/${entityId}`;
    case 'audit': return `/audits/${entityId}`;
    case 'audit_task': return details?.audit_id ? `/audits/${details.audit_id}` : null;
    case 'client_certification': return `/certifications/${entityId}`;
    default: return null;
  }
};

const ActivityLog = () => {
  const { data: activities = [], isLoading } = useActivityLog(2000);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const handleActivityClick = useCallback(async (
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown> | null
  ) => {
    if (!entityId) return;
    const link = getEntityLink(entityType, entityId, details);
    if (link) {
      navigate(link);
      return;
    }
    if (entityType === 'audit_task') {
      const { data } = await supabase
        .from('audit_tasks')
        .select('audit_id')
        .eq('id', entityId)
        .maybeSingle();
      if (data?.audit_id) navigate(`/audits/${data.audit_id}`);
    }
  }, [navigate]);

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (entityFilter !== 'all' && a.entity_type !== entityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (a.entity_name?.toLowerCase().includes(q)) ||
          (a.user_name?.toLowerCase().includes(q)) ||
          (a.action.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [activities, search, entityFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(a => {
      const day = format(new Date(a.created_at), 'yyyy-MM-dd');
      if (!groups[day]) groups[day] = [];
      groups[day].push(a);
    });
    return groups;
  }, [filtered]);

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        <PageHeader title="Aktivitäten-Protokoll" description="Übersicht aller Benutzeraktivitäten" />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Benutzer oder Aktion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Alle Typen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Aktivitäten
              <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Keine Aktivitäten gefunden</p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-6">
                  {Object.entries(grouped).map(([day, entries]) => (
                    <div key={day} className="space-y-2">
                      <div className="sticky top-0 bg-card z-10 py-1">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {format(new Date(day), 'EEEE, dd.MM.yyyy', { locale: de })}
                        </span>
                      </div>
                      {entries.map((activity) => {
                        const Icon = ENTITY_ICONS[activity.entity_type] || History;
                        const details = activity.details as Record<string, unknown> | null;
                        const link = getEntityLink(activity.entity_type, activity.entity_id, details);
                        const isClickable = !!link || (activity.entity_type === 'audit_task' && !!activity.entity_id);
                        return (
                          <div
                            key={activity.id}
                            onClick={() => isClickable && handleActivityClick(activity.entity_type, activity.entity_id, details)}
                            className={`flex items-start gap-3 p-3 rounded-lg bg-muted/50 transition-colors ${isClickable ? 'hover:bg-primary/10 cursor-pointer' : ''}`}
                          >
                            <div className="p-2 bg-background rounded-lg shadow-sm mt-0.5">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-xs ${ACTION_COLORS[activity.action] || ''}`}>
                                  {ACTION_LABELS[activity.action] || activity.action}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {ENTITY_LABELS[activity.entity_type] || activity.entity_type}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm font-medium text-foreground">
                                {activity.entity_name || '—'}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <User className="h-3 w-3" />
                                <span>{activity.user_name || 'Unbekannt'}</span>
                                <span className="text-muted-foreground/50">•</span>
                                <span>{format(new Date(activity.created_at), 'HH:mm', { locale: de })} Uhr</span>
                              </div>
                              {activity.details && Object.keys(activity.details).length > 0 && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {Object.entries(activity.details).map(([k, v]) => (
                                    <span key={k} className="mr-3">{k}: {String(v)}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                              {format(new Date(activity.created_at), 'HH:mm')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ActivityLog;
