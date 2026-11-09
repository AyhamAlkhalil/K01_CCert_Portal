import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewAuditDialog } from '@/components/NewAuditDialog';
import { useAudits, useDeleteAudit } from '@/hooks/useAudits';
import { useAuditTasks } from '@/hooks/useAuditTasks';
import { useClients } from '@/hooks/useClients';
import { useAuditors } from '@/hooks/useAuditors';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import { transformAuditToLocal } from '@/lib/auditUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, ChevronRight, Calendar, Building2, ClipboardCheck, Users, Trash2, X, RotateCcw } from 'lucide-react';
import { Audit } from '@/types/audit';
import { AUDIT_TYPE_LABELS, AUDIT_STATUS_CONFIG } from '@/lib/constants';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useIsMobile } from '@/hooks/use-mobile';
import { PageHeader } from '@/components/PageHeader';
import { MobileAuditCard } from '@/components/MobileAuditCard';

type StatusFilter = 'all' | 'scheduled' | 'in-progress' | 'completed';
type GroupBy = 'month' | 'client' | 'type' | 'none';

const TableRowSkeleton = () => (
  <TableRow>
    <TableCell colSpan={10}>
      <div className="flex items-center gap-4 px-2 py-1">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-8 ml-auto" />
      </div>
    </TableCell>
  </TableRow>
);

interface AuditRowProps {
  audit: Audit;
  onClick: () => void;
  showClient?: boolean;
  showType?: boolean;
  isSelected: boolean;
  onSelectChange: (selected: boolean) => void;
}

const AuditRow = ({
  audit,
  onClick,
  showClient = true,
  showType = true,
  isSelected,
  onSelectChange
}: AuditRowProps) => {
  const isToday = format(audit.scheduledDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const statusConfig = AUDIT_STATUS_CONFIG[audit.status];
  const pendingTasks = audit.tasks.filter(t => t.status !== 'completed').length;
  const overdueTasks = audit.tasks.filter(t => t.status === 'overdue' || (t.status !== 'completed' && t.dueDate < new Date())).length;

  return (
    <TableRow
      id={`audit-${audit.id}`}
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors scroll-mt-[100px] border-l-0",
        isSelected && "bg-primary/5",
        isToday && "bg-destructive/5 border-l-4 border-l-destructive shadow-sm"
      )}
      onClick={onClick}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectChange(!!checked)}
        />
      </TableCell>
      {showClient && (
        <TableCell className="font-medium text-left">{audit.clientName}</TableCell>
      )}
      <TableCell className="text-center">
        <div className="flex flex-wrap gap-1 justify-center">
          {audit.certifications.length > 0 ? audit.certifications.map((cert, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {cert}
            </Badge>
          )) : (
            <span className="text-xs text-muted-foreground">–</span>
          )}
        </div>
      </TableCell>
      {showType && (
        <TableCell>
          <span className="text-sm whitespace-nowrap">{AUDIT_TYPE_LABELS[audit.type]}</span>
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {format(audit.scheduledDate, 'dd.MM.yyyy')}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={statusConfig.variant}
          className={cn("text-[11px] px-2 py-0 h-5 whitespace-nowrap", statusConfig.className)}
        >
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium truncate max-w-[120px]">
          {audit.auditorName || <span className="text-muted-foreground opacity-50">–</span>}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm truncate max-w-[120px]">
          {audit.certificationBodyName || <span className="text-muted-foreground opacity-50">–</span>}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {audit.tasks.some(t => t.category === 'finding' && t.status !== 'completed') && (
            <Badge variant="destructive" className="text-[10px] py-0 h-4 w-fit">
              {audit.tasks.filter(t => t.category === 'finding' && t.status !== 'completed').length} NCs
            </Badge>
          )}
          {pendingTasks > 0 ? (
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-[11px]",
                overdueTasks > 0 ? "text-destructive font-semibold" : "text-muted-foreground"
              )}>
                {overdueTasks > 0 ? `${overdueTasks} fällig` : `${pendingTasks} Aufg.`}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-success font-medium whitespace-nowrap">✓ Erledigt</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right pr-4">
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

interface GroupHeaderProps {
  title: string;
  count: number;
  icon?: React.ReactNode;
}

const GroupHeader = ({ title, count, icon }: GroupHeaderProps) => (
  <div className="flex items-center gap-3 py-2.5 px-4 bg-secondary border-y border-border/50 sticky top-0 z-20">
    {icon}
    <span className="font-bold text-sm tracking-tight text-foreground">{title}</span>
    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold uppercase tracking-wider">{count}</Badge>
  </div>
);

const Audits = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('audits-search-query') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    (sessionStorage.getItem('audits-status-filter') as StatusFilter) || 'all'
  );
  const [groupBy, setGroupBy] = useState<GroupBy>(() =>
    (sessionStorage.getItem('audits-group-by') as GroupBy) || 'month'
  );
  const [showNewAuditDialog, setShowNewAuditDialog] = useState(false);
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | 'active' | 'inactive'>(() =>
    (sessionStorage.getItem('audits-client-status-filter') as 'all' | 'active' | 'inactive') || 'active'
  );
  const [consultantFilter, setConsultantFilter] = useState<string>(() =>
    sessionStorage.getItem('audits-consultant-filter') || 'all'
  );
  const [auditorFilter, setAuditorFilter] = useState<string>(() =>
    sessionStorage.getItem('audits-auditor-filter') || 'all'
  );
  const [certificationBodyFilter, setCertificationBodyFilter] = useState<string>(() =>
    sessionStorage.getItem('audits-cert-body-filter') || 'all'
  );
  const [selectedAuditIds, setSelectedAuditIds] = useState<Set<string>>(new Set());

  const { data: dbAudits = [], isLoading: auditsLoading, error: auditsError } = useAudits();
  const deleteAudit = useDeleteAudit();
  const { data: tasks = [], isLoading: tasksLoading } = useAuditTasks();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: auditors = [] } = useAuditors();
  const { data: certificationBodies = [] } = useCertificationBodies();
  const scrollRef = useScrollPersistence();
  const isMobile = useIsMobile();

  const clientMap = useMemo(() => {
    const map = new Map<string, { is_active: boolean; consultant: string | null }>();
    clients.forEach(c => map.set(c.id, { is_active: c.is_active, consultant: c.consultant }));
    return map;
  }, [clients]);

  const consultants = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => { if (c.consultant) set.add(c.consultant); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [clients]);

  const audits = useMemo(() =>
    dbAudits.map(audit => transformAuditToLocal(audit, tasks)),
    [dbAudits, tasks]
  );

  const filteredAudits = useMemo(() => {
    return audits
      .filter(audit => {
        const matchesSearch = audit.clientName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;

        const clientInfo = clientMap.get(audit.clientId);
        const matchesClientStatus = clientStatusFilter === 'all'
          || (clientStatusFilter === 'active' && clientInfo?.is_active === true)
          || (clientStatusFilter === 'inactive' && clientInfo?.is_active === false);
        const matchesConsultant = consultantFilter === 'all' || clientInfo?.consultant === consultantFilter;

        const matchesAuditor = auditorFilter === 'all' || audit.auditorId === auditorFilter;
        const matchesCertBody = certificationBodyFilter === 'all' || audit.certificationBodyId === certificationBodyFilter;

        return matchesSearch && matchesStatus && matchesClientStatus && matchesConsultant && matchesAuditor && matchesCertBody;
      })
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }, [audits, searchQuery, statusFilter, clientStatusFilter, consultantFilter, auditorFilter, certificationBodyFilter, clientMap]);

  const scrollToToday = useCallback(() => {
    // 1. First attempt: Scroll directly to the first audit of "Today" or the next upcoming audit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingAudit = filteredAudits.find(audit => {
      const auditDate = new Date(audit.scheduledDate);
      auditDate.setHours(0, 0, 0, 0);
      return auditDate >= today;
    });

    if (upcomingAudit) {
      const element = document.getElementById(`audit-${upcomingAudit.id}`);
      if (element && scrollRef.current) {
        const container = scrollRef.current;
        const elementTop = element.getBoundingClientRect().top;
        const containerTop = container.getBoundingClientRect().top;
        // Scroll to the specific row but subtract a small offset so the context isn't cut off
        const offset = elementTop - containerTop + container.scrollTop - 80;
        container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        return;
      }
    }

    // 2. Fallback: Scroll to the start of the current month group header
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const element = document.getElementById(`month-${currentMonthKey}`);
    if (element && scrollRef.current) {
      const container = scrollRef.current;
      const elementTop = element.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const offset = elementTop - containerTop + container.scrollTop;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, [scrollRef, filteredAudits]);

  // Scroll to today on initial load once audits are loaded
  useEffect(() => {
    if (!auditsLoading && audits.length > 0 && groupBy === 'month') {
      const timer = setTimeout(() => {
        scrollToToday();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [auditsLoading, groupBy, audits.length, scrollToToday]);

  const handleViewDetails = useCallback((audit: Audit) => {
    navigate(`/audits/${audit.id}`);
  }, [navigate]);

  const groupedAudits = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: 'Alle Audits', audits: filteredAudits }];
    }

    const groups = new Map<string, { title: string; audits: Audit[]; sortKey: string }>();

    filteredAudits.forEach(audit => {
      let key: string;
      let title: string;
      let sortKey: string;

      if (groupBy === 'month') {
        key = format(audit.scheduledDate, 'yyyy-MM');
        title = format(audit.scheduledDate, 'MMMM yyyy', { locale: de });
        sortKey = key;
      } else if (groupBy === 'client') {
        key = audit.clientId;
        title = audit.clientName;
        sortKey = title;
      } else {
        key = audit.type;
        title = AUDIT_TYPE_LABELS[audit.type];
        sortKey = title;
      }

      if (!groups.has(key)) {
        groups.set(key, { title, audits: [], sortKey });
      }
      groups.get(key)!.audits.push(audit);
    });

    return Array.from(groups.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => groupBy === 'month' ? a.sortKey.localeCompare(b.sortKey) : a.title.localeCompare(b.title, 'de'));
  }, [filteredAudits, groupBy]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setClientStatusFilter('active');
    setConsultantFilter('all');
    setAuditorFilter('all');
    setCertificationBodyFilter('all');

    sessionStorage.removeItem('audits-search-query');
    sessionStorage.removeItem('audits-status-filter');
    sessionStorage.removeItem('audits-client-status-filter');
    sessionStorage.removeItem('audits-consultant-filter');
    sessionStorage.removeItem('audits-auditor-filter');
    sessionStorage.removeItem('audits-cert-body-filter');

    toast.success('Filter zurückgesetzt');
  }, []);

  const toggleAuditSelection = (auditId: string) => {
    setSelectedAuditIds(prev => {
      const next = new Set(prev);
      if (next.has(auditId)) next.delete(auditId);
      else next.add(auditId);
      return next;
    });
  };

  const toggleAllInGroup = (auditIds: string[]) => {
    setSelectedAuditIds(prev => {
      const next = new Set(prev);
      const allSelected = auditIds.every(id => next.has(id));
      if (allSelected) {
        auditIds.forEach(id => next.delete(id));
      } else {
        auditIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const isLoading = auditsLoading || tasksLoading || clientsLoading;

  return (
    <>
      <div className="h-full flex flex-col animate-fade-in">
        {/* Header - Not Sticky */}
        <div className="p-4 sm:p-6 lg:px-8 lg:pt-8 pb-3 sm:pb-3 shrink-0">
          <PageHeader
            title="Audits"
            description={`${filteredAudits.length} Audit${filteredAudits.length !== 1 ? 's' : ''} gefunden`}
            actions={
              <Button className="gap-2" onClick={() => setShowNewAuditDialog(true)}>
                <Plus className="h-4 w-4" />
                Neues Audit
              </Button>
            }
          />
        </div>

        {/* ═══ FILTER BAR — shrink-0 means it never scrolls away ═══ */}
        <div className="shrink-0 bg-background border-b border-border/70 px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          {/* Row 1: Search + Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center">
            <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kunde suchen..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  sessionStorage.setItem('audits-search-query', e.target.value);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={clientStatusFilter} onValueChange={(v) => { setClientStatusFilter(v as 'all' | 'active' | 'inactive'); sessionStorage.setItem('audits-client-status-filter', v); }}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="border shadow-lg z-[100]">
                  <SelectItem value="all">Alle Kunden</SelectItem>
                  <SelectItem value="active">Nur aktive</SelectItem>
                  <SelectItem value="inactive">Nur inaktive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={consultantFilter} onValueChange={(v) => { setConsultantFilter(v); sessionStorage.setItem('audits-consultant-filter', v); }}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Berater..." /></SelectTrigger>
                <SelectContent className="border shadow-lg z-[100]">
                  <SelectItem value="all">Alle Berater</SelectItem>
                  {consultants.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={auditorFilter} onValueChange={(v) => { setAuditorFilter(v); sessionStorage.setItem('audits-auditor-filter', v); }}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Auditor..." /></SelectTrigger>
                <SelectContent className="border shadow-lg z-[100]">
                  <SelectItem value="all">Alle Auditoren</SelectItem>
                  {auditors.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={certificationBodyFilter} onValueChange={(v) => { setCertificationBodyFilter(v); sessionStorage.setItem('audits-cert-body-filter', v); }}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Zertifizierer..." /></SelectTrigger>
                <SelectContent className="border shadow-lg z-[100]">
                  <SelectItem value="all">Alle Zertifizierer</SelectItem>
                  {certificationBodies.map(cb => <SelectItem key={cb.id} value={cb.id}>{cb.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden lg:inline">Gruppe:</span>
                <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupBy); sessionStorage.setItem('audits-group-by', v); }}>
                  <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="border shadow-lg z-[100]">
                    <SelectItem value="month"><div className="flex items-center gap-2 text-xs"><Calendar className="h-3.5 w-3.5" /> Monat</div></SelectItem>
                    <SelectItem value="client"><div className="flex items-center gap-2 text-xs"><Users className="h-3.5 w-3.5" /> Kunde</div></SelectItem>
                    <SelectItem value="type"><div className="flex items-center gap-2 text-xs"><ClipboardCheck className="h-3.5 w-3.5" /> Auditart</div></SelectItem>
                    <SelectItem value="none"><div className="flex items-center gap-2 text-xs">Ohne</div></SelectItem>
                  </SelectContent>
                </Select>
                {groupBy === 'month' && (
                  <Button variant="outline" size="sm" className="h-9 px-3 text-xs" onClick={scrollToToday} title="Zum heutigen Tag springen">
                    Heute
                  </Button>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground hover:text-foreground text-xs" onClick={handleResetFilters} title="Alle Filter zurücksetzen">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            </div>
          </div>

          {/* Row 2: Status Tabs */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 w-fit max-w-full overflow-x-auto">
            {(['all', 'scheduled', 'in-progress', 'completed'] as StatusFilter[]).map((val) => {
              const labels: Record<StatusFilter, string> = { all: 'Alle', scheduled: 'Geplant', 'in-progress': 'In Bearbeitung', completed: 'Fertig' };
              return (
                <button
                  key={val}
                  onClick={() => { setStatusFilter(val); sessionStorage.setItem('audits-status-filter', val); }}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                    statusFilter === val
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {labels[val]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:px-8 space-y-6">
            {auditsError ? (
              <div className="text-center py-12">
                <p className="text-destructive">Fehler beim Laden der Audits</p>
              </div>
            ) : isLoading ? (
              <div className="border rounded-lg overflow-hidden bg-background">
                {!isMobile ? (
                  <Table className="table-fixed w-full min-w-[1000px] [&_td]:px-3 [&_th]:px-3">
                    {/* ... (Existing Desktop Loading Table) ... */}
                  </Table>
                ) : (
                  <div className="space-y-3 p-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                  </div>
                )}
              </div>
            ) : filteredAudits.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-lg bg-background/50 backdrop-blur-sm">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground/70">Keine Audits gefunden</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
                  Überprüfen Sie Ihre Filter oder erstellen Sie ein neues Audit.
                </p>
                <Button variant="outline" onClick={handleResetFilters}>
                  Filter zurücksetzen
                </Button>
              </div>
            ) : (
              <div className="space-y-6 lg:space-y-8">
                {groupedAudits.map((group) => (
                  <div key={group.key} className={cn(
                    "flex flex-col gap-2",
                    !isMobile && "border rounded-lg overflow-hidden bg-card shadow-sm border-border/60"
                  )}>
                    {groupBy !== 'none' && (
                      <GroupHeader
                        title={group.title}
                        count={group.audits.length}
                        icon={groupBy === 'month'
                          ? <Calendar className="h-4 w-4 text-primary" />
                          : groupBy === 'client'
                            ? <Users className="h-4 w-4 text-primary" />
                            : <ClipboardCheck className="h-4 w-4 text-primary" />
                        }
                      />
                    )}
                    <div id={groupBy === 'month' ? `month-${group.key}` : undefined} className="scroll-mt-[200px]">
                      {!isMobile ? (
                        <Table className="table-fixed w-full min-w-[1000px] [&_td]:px-3 [&_th]:px-3">
                          <TableHeader className="bg-muted/10">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[40px]">
                                <Checkbox
                                  checked={group.audits.every(a => selectedAuditIds.has(a.id))}
                                  onCheckedChange={() => toggleAllInGroup(group.audits.map(a => a.id))}
                                />
                              </TableHead>
                              {groupBy !== 'client' && <TableHead className="text-left w-[13%]">Kunde</TableHead>}
                              <TableHead className="text-center w-[8%]">Zert.</TableHead>
                              {groupBy !== 'type' && <TableHead className="text-left w-[16%]">Art</TableHead>}
                              <TableHead className="text-left w-[12.5%]">Datum</TableHead>
                              <TableHead className="text-left w-[12.5%]">Status</TableHead>
                              <TableHead className="text-left w-[11.5%]">Auditor</TableHead>
                              <TableHead className="text-left w-[11%]">Zertifizierer</TableHead>
                              <TableHead className="text-left w-[7.5%]">Check</TableHead>
                              <TableHead className="w-[40px] text-right pr-4"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.audits.map((audit) => (
                              <AuditRow
                                key={audit.id}
                                audit={audit}
                                onClick={() => handleViewDetails(audit)}
                                showClient={groupBy !== 'client'}
                                showType={groupBy !== 'type'}
                                isSelected={selectedAuditIds.has(audit.id)}
                                onSelectChange={() => toggleAuditSelection(audit.id)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {group.audits.map((audit) => (
                            <MobileAuditCard
                              key={audit.id}
                              audit={audit}
                              onClick={() => handleViewDetails(audit)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      <NewAuditDialog open={showNewAuditDialog} onOpenChange={setShowNewAuditDialog} />

      {/* Bulk Action Bar */}
      {selectedAuditIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 border border-primary-foreground/10 ring-4 ring-background">
            <div className="flex items-center gap-2 border-r border-primary-foreground/20 pr-6">
              <span className="text-sm font-semibold tabular-nums">{selectedAuditIds.size}</span>
              <span className="text-xs font-medium opacity-90">Ausgewählt</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 font-medium text-xs gap-2 h-8"
                disabled={deleteAudit.isPending}
                onClick={async () => {
                  if (!confirm(`${selectedAuditIds.size} Audit${selectedAuditIds.size !== 1 ? 's' : ''} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
                  const ids = Array.from(selectedAuditIds);
                  let failed = 0;
                  for (const id of ids) {
                    try {
                      await deleteAudit.mutateAsync(id);
                    } catch {
                      failed++;
                    }
                  }
                  setSelectedAuditIds(new Set());
                  if (failed === 0) {
                    toast.success(`${ids.length} Audit${ids.length !== 1 ? 's' : ''} gelöscht`);
                  } else {
                    toast.error(`${failed} von ${ids.length} konnten nicht gelöscht werden`);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Löschen
              </Button>
              <div className="h-4 w-[1px] bg-primary-foreground/20 mx-2" />
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 p-0 flex items-center justify-center rounded-full"
                onClick={() => setSelectedAuditIds(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Audits;
