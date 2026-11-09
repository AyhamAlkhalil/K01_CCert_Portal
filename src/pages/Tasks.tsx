import { memo, useState, useMemo, useCallback, useEffect, useTransition, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format, parseISO, isBefore, startOfDay,
  isToday, isThisWeek, isThisMonth,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CheckSquare, Search, X, ExternalLink, ChevronDown, ChevronRight,
  User, Calendar, Building2, Tag, SlidersHorizontal, ArrowUpDown,
  UserCheck, Circle, CheckCircle2, RotateCcw, Briefcase, ChevronsUpDown, Check,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAllAuditTasks, useUpdateAuditTask, DbAuditTaskFull, TaskStatus } from '@/hooks/useAuditTasks';
import { useConsultants } from '@/hooks/useConsultants';
import { TASK_STATUS_CONFIG, AUDIT_TYPE_LABELS } from '@/lib/constants';
import { EditFindingDialog } from '@/components/EditFindingDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import { AuditType } from '@/types/audit';
import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusFilter  = 'all' | TaskStatus;
type CategoryFilter = 'all' | 'task' | 'finding';
type DueFilter     = 'all' | 'overdue' | 'today' | 'this-week' | 'this-month';
type SortDir       = 'asc' | 'desc';
type GroupBy       = 'status' | 'due-date' | 'audit' | 'client' | 'auditor' | 'none';

// ─── SessionStorage keys ──────────────────────────────────────────────────────

const SS_SEARCH     = 'tasks-search-query';
const SS_STATUS     = 'tasks-status-filter';
const SS_CATEGORY   = 'tasks-category-filter';
const SS_DUE        = 'tasks-due-filter';
const SS_GROUP      = 'tasks-group-by';
const SS_SORT_DIR   = 'tasks-sort-dir';
const SS_AUDITOR    = 'tasks-auditor-filter';
const SS_CLIENT     = 'tasks-client-filter';
const SS_AUDIT_TYPE = 'tasks-audit-type-filter';
const SS_SEVERITY    = 'tasks-severity-filter';
const SS_ASSIGNED    = 'tasks-assigned-filter';
const SS_YEAR        = 'tasks-year-filter';
const SS_CONSULTANT  = 'tasks-consultant-filter';


const CURRENT_YEAR = String(new Date().getFullYear());

const ALL_SS_KEYS = [
  SS_SEARCH, SS_STATUS, SS_CATEGORY, SS_DUE, SS_GROUP,
  SS_SORT_DIR, SS_AUDITOR, SS_CLIENT, SS_AUDIT_TYPE, SS_SEVERITY, SS_ASSIGNED,
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_GROUP_ORDER: TaskStatus[] = ['overdue', 'in-progress', 'pending', 'completed'];

const SEVERITY_LABELS: Record<string, string> = {
  major: 'Haupt-NK', minor: 'Neben-NK', recommendation: 'Empfehlung',
};
const SEVERITY_CLASSES: Record<string, string> = {
  major: 'bg-destructive/[0.12] text-destructive border-destructive/30',
  minor: 'bg-warning/[0.12] text-warning border-warning/30',
  recommendation: 'bg-secondary text-secondary-foreground border-border',
};

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',         label: 'Alle' },
  { value: 'overdue',     label: 'Überfällig' },
  { value: 'in-progress', label: 'In Bearbeitung' },
  { value: 'pending',     label: 'Ausstehend' },
  { value: 'completed',   label: 'Abgeschlossen' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEffectiveStatus(task: DbAuditTaskFull): TaskStatus {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'in-progress') return 'in-progress';
  if (isBefore(parseISO(task.due_date), startOfDay(new Date()))) return 'overdue';
  return task.status as TaskStatus;
}

function ss(key: string) { return sessionStorage.getItem(key) ?? ''; }

// ─── CompleteButton ───────────────────────────────────────────────────────────

const CompleteButton = memo(({ task, onComplete }: {
  task: DbAuditTaskFull;
  onComplete: (task: DbAuditTaskFull) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const isCompleted = task.status === 'completed';

  const Icon = isCompleted
    ? hovered ? RotateCcw : CheckCircle2
    : hovered ? CheckCircle2 : Circle;

  return (
    <button
      data-no-dialog
      onClick={(e) => { e.stopPropagation(); onComplete(task); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isCompleted ? 'Als offen markieren' : 'Als erledigt markieren'}
      className={cn(
        'shrink-0 transition-colors rounded-full p-0.5',
        isCompleted
          ? hovered ? 'text-muted-foreground' : 'text-success'
          : hovered ? 'text-success' : 'text-muted-foreground/40 hover:text-muted-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
});
CompleteButton.displayName = 'CompleteButton';

// ─── TaskRow ──────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: DbAuditTaskFull;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onComplete: (task: DbAuditTaskFull) => void;
  onEdit: (task: DbAuditTaskFull) => void;
}

const TaskRow = memo(({ task, isSelected, onSelect, onComplete, onEdit }: TaskRowProps) => {
  const navigate = useNavigate();
  const effectiveStatus = getEffectiveStatus(task);
  const statusCfg  = TASK_STATUS_CONFIG[effectiveStatus];
  const isOverdue  = effectiveStatus === 'overdue';
  const isCompleted = task.status === 'completed';
  const isFinding  = task.category === 'finding';

  const clientName     = task.audits?.clients?.name ?? '';
  const auditorName    = task.audits?.auditors?.name ?? '';
  const consultantName = task.audits?.clients?.consultants?.name ?? '';
  const auditType   = task.audits ? (AUDIT_TYPE_LABELS[task.audits.type as AuditType] ?? task.audits.type) : '';
  const auditDate   = task.audits ? format(parseISO(task.audits.scheduled_date), 'dd.MM.yyyy') : '';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0',
        'cursor-pointer hover:bg-muted/30 transition-colors group',
        isSelected && 'bg-primary/5',
        isOverdue && !isSelected && 'bg-destructive/5',
        isCompleted && 'opacity-60',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-no-dialog]')) return;
        onEdit(task);
      }}
    >
      {/* Auswahl-Checkbox */}
      <div data-no-dialog className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(task.id)}
          className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
        />
      </div>

      {/* Erledigt-Button */}
      <CompleteButton task={task} onComplete={onComplete} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <Badge variant="outline" className="text-xs shrink-0 font-normal">
            {isFinding ? 'Befund' : 'Aufgabe'}
          </Badge>
          {isFinding && task.severity && (
            <Badge variant="outline" className={cn('text-xs shrink-0', SEVERITY_CLASSES[task.severity])}>
              {SEVERITY_LABELS[task.severity] ?? task.severity}
            </Badge>
          )}
          <span className={cn('text-sm font-medium truncate', isCompleted && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn('flex items-center gap-1', isOverdue && 'text-destructive font-medium')}>
            <Calendar className="h-3 w-3 shrink-0" />
            {format(parseISO(task.due_date), 'dd.MM.yyyy')}
          </span>
          {task.assigned_to && (
            <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{task.assigned_to}</span>
          )}
          {consultantName && (
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3 shrink-0" />{consultantName}</span>
          )}
          {auditorName && (
            <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 shrink-0" />{auditorName}</span>
          )}
          {clientName && (
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{clientName}</span>
          )}
          {auditType && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3 shrink-0" />
              {auditType}{auditDate && ` – ${auditDate}`}
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 shrink-0">
        <Badge className={cn('text-xs hidden sm:inline-flex', statusCfg.bg, statusCfg.color)}>
          {statusCfg.label}
        </Badge>
        {task.audits && (
          <Button
            data-no-dialog size="icon" variant="ghost" className="h-7 w-7"
            title="Zum Audit"
            onClick={(e) => { e.stopPropagation(); navigate(`/audits/${task.audits!.id}`); }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
TaskRow.displayName = 'TaskRow';

// ─── TaskGroup ────────────────────────────────────────────────────────────────

interface TaskGroupProps {
  label: string;
  tasks: DbAuditTaskFull[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onComplete: (task: DbAuditTaskFull) => void;
  onEdit: (task: DbAuditTaskFull) => void;
}

const TaskGroup = memo(({ label, tasks, selectedIds, onSelect, onSelectAll, onComplete, onEdit }: TaskGroupProps) => {
  const [collapsed, setCollapsed] = useState(true);
  const allSelected = tasks.length > 0 && tasks.every(t => selectedIds.has(t.id));
  const someSelected = tasks.some(t => selectedIds.has(t.id));

  return (
    <div className="mb-4 rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
      <div className="group flex items-center gap-2 px-4 py-2.5 bg-muted/40">
        {/* Gruppe alle auswählen */}
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={allSelected}
            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
            onCheckedChange={() => onSelectAll(tasks.map(t => t.id))}
            className={cn('transition-opacity', !someSelected && 'opacity-0 group-hover:opacity-100')}
          />
        </div>
        <button
          className="flex items-center gap-2 flex-1 text-left"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-xs text-muted-foreground bg-card border border-border rounded-full px-2 py-0.5 leading-none">
            {tasks.length}
          </span>
        </button>
      </div>

      {!collapsed && (
        <div>
          {tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              isSelected={selectedIds.has(task.id)}
              onSelect={onSelect}
              onComplete={onComplete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
});
TaskGroup.displayName = 'TaskGroup';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const TasksSkeleton = () => (
  <div className="space-y-4">
    {[3, 2, 4].map((count, gi) => (
      <div key={gi} className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40"><Skeleton className="h-4 w-32" /></div>
        {Array.from({ length: count }).map((_, ti) => (
          <div key={ti} className="flex gap-3 px-4 py-3 border-b border-border/50 last:border-0">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

// ─── FilterSelect ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onValueChange, width = 'w-[155px]', children }: {
  value: string; onValueChange: (v: string) => void; width?: string; children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('h-9', width)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

// ─── ClientFilterCombobox ─────────────────────────────────────────────────────

function ClientFilterCombobox({ value, onValueChange, clients }: {
  value: string;
  onValueChange: (v: string) => void;
  clients: [string, string][];
}) {
  const [open, setOpen] = useState(false);
  const selectedName = value ? clients.find(([id]) => id === value)?.[1] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-[175px] justify-between font-normal text-sm"
        >
          <span className="truncate">{selectedName ?? 'Alle Kunden'}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Kunde suchen…" className="h-9" />
          <CommandList>
            <CommandEmpty>Kein Kunde gefunden.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all" onSelect={() => { onValueChange(''); setOpen(false); }}>
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                Alle Kunden
              </CommandItem>
              {clients.map(([id, name]) => (
                <CommandItem key={id} value={name} onSelect={() => { onValueChange(id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === id ? 'opacity-100' : 'opacity-0')} />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Tasks() {
  const scrollRef = useScrollPersistence();

  const [searchQuery,    setSearchQuery]    = useState(() => ss(SS_SEARCH));
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => ss(SS_SEARCH));
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>(() => (ss(SS_STATUS) as StatusFilter) || 'all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => (ss(SS_CATEGORY) as CategoryFilter) || 'all');
  const [dueFilter,      setDueFilter]      = useState<DueFilter>(() => (ss(SS_DUE) as DueFilter) || 'all');
  const [groupBy,        setGroupBy]        = useState<GroupBy>(() => (ss(SS_GROUP) as GroupBy) || 'due-date');
  const [sortDir,        setSortDir]        = useState<SortDir>(() => (ss(SS_SORT_DIR) as SortDir) || 'asc');
  const [auditorFilter,  setAuditorFilter]  = useState(() => ss(SS_AUDITOR));
  const [clientFilter,   setClientFilter]   = useState(() => ss(SS_CLIENT));
  const [auditTypeFilter,setAuditTypeFilter]= useState(() => ss(SS_AUDIT_TYPE));
  const [severityFilter, setSeverityFilter] = useState(() => ss(SS_SEVERITY));
  const [assignedFilter,    setAssignedFilter]    = useState(() => ss(SS_ASSIGNED));
  const [yearFilter,        setYearFilter]        = useState(() => ss(SS_YEAR) || CURRENT_YEAR);
  const [consultantFilter,  setConsultantFilter]  = useState(() => ss(SS_CONSULTANT));
  const [advancedOpen,   setAdvancedOpen]   = useState(
    () => !!(ss(SS_AUDITOR) || ss(SS_CLIENT) || ss(SS_AUDIT_TYPE) || ss(SS_SEVERITY) || ss(SS_ASSIGNED))
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editTask,    setEditTask]    = useState<DbAuditTaskFull | null>(null);
  const [editOpen,    setEditOpen]    = useState(false);

  const { data: tasks, isLoading } = useAllAuditTasks();
  const updateTask = useUpdateAuditTask();
  const { data: allConsultants = [] } = useConsultants();
  const activeConsultants = useMemo(() => allConsultants.filter(c => c.is_active), [allConsultants]);
  const [isPending, startTransition] = useTransition();

  // ── Persisted setters (Filter-Updates als Transition — UI bleibt sofort responsiv) ──

  const persist = useCallback(<T extends string>(setter: Dispatch<SetStateAction<T>>, key: string) =>
    (v: T) => { sessionStorage.setItem(key, v); startTransition(() => setter(v)); }, [startTransition]);

  const setSearch    = useCallback((v: string) => { setSearchQuery(v); sessionStorage.setItem(SS_SEARCH, v); }, []);
  const setStatus    = useCallback(persist(setStatusFilter,    SS_STATUS),    [persist]);
  const setCategory  = useCallback(persist(setCategoryFilter,  SS_CATEGORY),  [persist]);
  const setDue       = useCallback(persist(setDueFilter,       SS_DUE),       [persist]);
  const setGroup     = useCallback(persist(setGroupBy,         SS_GROUP),     [persist]);
  const setSort      = useCallback(persist(setSortDir,         SS_SORT_DIR),  [persist]);
  const setAuditor   = useCallback(persist(setAuditorFilter,   SS_AUDITOR),   [persist]);
  const setClient    = useCallback(persist(setClientFilter,    SS_CLIENT),    [persist]);
  const setAuditType = useCallback(persist(setAuditTypeFilter, SS_AUDIT_TYPE),[persist]);
  const setSeverity  = useCallback(persist(setSeverityFilter,  SS_SEVERITY),  [persist]);
  const setAssigned  = useCallback(persist(setAssignedFilter,  SS_ASSIGNED),  [persist]);
  const setYear       = useCallback((v: string) => { sessionStorage.setItem(SS_YEAR, v); startTransition(() => setYearFilter(v)); }, [startTransition]);
  const setConsultant = useCallback(persist(setConsultantFilter, SS_CONSULTANT), [persist]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const handleReset = useCallback(() => {
    setSearchQuery('');
    ALL_SS_KEYS.forEach(k => sessionStorage.removeItem(k));
    sessionStorage.setItem(SS_YEAR, CURRENT_YEAR);
    sessionStorage.setItem(SS_GROUP, 'due-date');
    startTransition(() => {
      setDebouncedSearchQuery('');
      setStatusFilter('all'); setCategoryFilter('all');
      setDueFilter('all'); setGroupBy('due-date'); setSortDir('asc');
      setAuditorFilter(''); setClientFilter(''); setAuditTypeFilter('');
      setSeverityFilter(''); setAssignedFilter(''); setConsultantFilter('');
      setSelectedIds(new Set());
      setYearFilter(CURRENT_YEAR);
    });
  }, [startTransition]);

  // ── Select ───────────────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allIn = ids.every(id => next.has(id));
      ids.forEach(id => allIn ? next.delete(id) : next.add(id));
      return next;
    });
  }, []);

  // ── Complete ─────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (task: DbAuditTaskFull) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateTask.mutateAsync({
        id: task.id, status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      });
      toast.success(newStatus === 'completed' ? 'Aufgabe abgeschlossen' : 'Aufgabe wieder geöffnet');
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  }, [updateTask]);

  const handleBulkComplete = useCallback(async () => {
    const toComplete = (tasks ?? []).filter(t => selectedIds.has(t.id) && t.status !== 'completed');
    if (!toComplete.length) { setSelectedIds(new Set()); return; }
    try {
      await Promise.all(toComplete.map(t =>
        updateTask.mutateAsync({ id: t.id, status: 'completed', completed_at: new Date().toISOString() })
      ));
      toast.success(`${toComplete.length} Aufgabe${toComplete.length !== 1 ? 'n' : ''} abgeschlossen`);
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
    setSelectedIds(new Set());
  }, [tasks, selectedIds, updateTask]);

  const handleEdit = useCallback((task: DbAuditTaskFull) => { setEditTask(task); setEditOpen(true); }, []);

  // ── Dynamic options ───────────────────────────────────────────────────────

  // ── Ein Loop für alle tasks-Derivate — läuft nur bei neuen Daten ────────

  const { taskMeta, todayMs, uniqueYears, uniqueAuditors, uniqueClients, uniqueConsultants } = useMemo(() => {
    const todayMs  = startOfDay(new Date()).getTime();
    const taskMeta = new Map<string, { dueMs: number; eff: TaskStatus }>();
    const auditors    = new Map<string, string>();
    const clients     = new Map<string, string>();
    const years       = new Set<number>();
    const consultants = new Map<string, string>();

    for (const task of tasks ?? []) {
      const dueMs = parseISO(task.due_date).getTime();
      const eff: TaskStatus =
        task.status === 'completed'   ? 'completed' :
        task.status === 'in-progress' ? 'in-progress' :
        dueMs < todayMs               ? 'overdue' :
                                        task.status as TaskStatus;
      taskMeta.set(task.id, { dueMs, eff });
      years.add(new Date(dueMs).getFullYear());
      if (task.audits?.auditors) auditors.set(task.audits.auditors.id, task.audits.auditors.name);
      if (task.audits?.clients)  clients.set(task.audits.clients.id,   task.audits.clients.name);
      const c = task.audits?.clients?.consultants;
      if (c)                     consultants.set(c.id, c.name);
    }

    return {
      taskMeta,
      todayMs,
      uniqueYears:       [...years].sort((a, b) => b - a),
      uniqueAuditors:    [...auditors.entries()].sort(([, a], [, b])    => a.localeCompare(b, 'de')),
      uniqueClients:     [...clients.entries()].sort(([, a], [, b])     => a.localeCompare(b, 'de')),
      uniqueConsultants: [...consultants.entries()].sort(([, a], [, b]) => a.localeCompare(b, 'de')),
    };
  }, [tasks]);

  // ── Filter ────────────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(task => {
        const { dueMs, eff } = taskMeta.get(task.id)!;
        if (yearFilter !== 'all' && new Date(dueMs).getFullYear() !== parseInt(yearFilter)) return false;
        if (debouncedSearchQuery) {
          const q = debouncedSearchQuery.toLowerCase();
          if (
            !task.title.toLowerCase().includes(q) &&
            !(task.assigned_to ?? '').toLowerCase().includes(q) &&
            !(task.audits?.clients?.name ?? '').toLowerCase().includes(q) &&
            !(task.audits?.auditors?.name ?? '').toLowerCase().includes(q)
          ) return false;
        }
        if (statusFilter   !== 'all' && eff !== statusFilter)                   return false;
        if (categoryFilter === 'task'    && task.category === 'finding')         return false;
        if (categoryFilter === 'finding' && task.category !== 'finding')         return false;
        if (dueFilter !== 'all') {
          if (dueFilter === 'overdue'    && (dueMs >= todayMs || task.status === 'completed')) return false;
          if (dueFilter === 'today'      && !isToday(dueMs))                           return false;
          if (dueFilter === 'this-week'  && !isThisWeek(dueMs, { weekStartsOn: 1 }))   return false;
          if (dueFilter === 'this-month' && !isThisMonth(dueMs))                       return false;
        }
        if (auditorFilter   && task.audits?.auditors?.id !== auditorFilter)   return false;
        if (clientFilter    && task.audits?.clients?.id  !== clientFilter)    return false;
        if (auditTypeFilter && task.audits?.type         !== auditTypeFilter) return false;
        if (severityFilter  && task.severity             !== severityFilter)  return false;
        if (assignedFilter    && task.assigned_to                          !== assignedFilter)    return false;
        if (consultantFilter  && task.audits?.clients?.consultants?.id    !== consultantFilter)  return false;
        return true;
      })
      .sort((a, b) => {
        const diff = taskMeta.get(a.id)!.dueMs - taskMeta.get(b.id)!.dueMs;
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [tasks, taskMeta, todayMs, yearFilter, debouncedSearchQuery, statusFilter, categoryFilter, dueFilter, sortDir,
      auditorFilter, clientFilter, auditTypeFilter, severityFilter, assignedFilter, consultantFilter]);

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groups = useMemo(() => {
    const map = new Map<string, { tasks: DbAuditTaskFull[]; order: number }>();
    filteredTasks.forEach(task => {
      let key: string; let order: number;
      switch (groupBy) {
        case 'status': {
          const eff = taskMeta.get(task.id)!.eff;
          key = TASK_STATUS_CONFIG[eff].label; order = STATUS_GROUP_ORDER.indexOf(eff); break;
        }
        case 'due-date': {
          const dueMs = taskMeta.get(task.id)!.dueMs;
          key = format(dueMs, 'MMMM yyyy', { locale: de });
          order = dueMs; break;
        }
        case 'audit':
          if (task.audits) {
            const auditMs = parseISO(task.audits.scheduled_date).getTime();
            const lbl = AUDIT_TYPE_LABELS[task.audits.type as AuditType] ?? task.audits.type;
            key = `${lbl} – ${format(auditMs, 'dd.MM.yyyy')}`; order = auditMs;
          } else { key = 'Kein Audit'; order = Number.MAX_SAFE_INTEGER; }
          break;
        case 'client':
          key = task.audits?.clients?.name ?? 'Kein Kunde'; order = 0; break;
        case 'auditor':
          key = task.audits?.auditors?.name ?? 'Kein Auditor'; order = 0; break;
        default:
          key = 'Alle Aufgaben'; order = 0;
      }
      if (!map.has(key)) map.set(key, { tasks: [], order });
      map.get(key)!.tasks.push(task);
    });
    return [...map.entries()]
      .sort(([ka, a], [kb, b]) =>
        (groupBy === 'client' || groupBy === 'auditor') ? ka.localeCompare(kb, 'de') : a.order - b.order
      )
      .map(([label, { tasks: gt }]) => ({ label, tasks: gt }));
  }, [filteredTasks, groupBy, taskMeta]);

  const advancedFilterCount = [auditorFilter, clientFilter, auditTypeFilter, severityFilter, assignedFilter, consultantFilter].filter(Boolean).length;
  const hasActiveFilters = !!searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || dueFilter !== 'all' || advancedFilterCount > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 pb-0">

          {/* Title */}
          <PageHeader
            className="mb-4"
            title="Aufgaben"
            description={isLoading ? undefined : `${filteredTasks.length} ${filteredTasks.length === 1 ? 'Aufgabe' : 'Aufgaben'} gefunden`}
          />

          {/* Primary filters */}
          <div className="flex flex-wrap gap-2 mb-2">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 h-11 sm:h-9"
                placeholder="Titel, Zuständige, Auditor, Kunde..."
                value={searchQuery}
                onChange={e => setSearch(e.target.value)}
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <FilterSelect value={yearFilter} onValueChange={setYear} width="w-[110px]">
              <SelectItem value="all">Alle Jahre</SelectItem>
              {uniqueYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </FilterSelect>

            <FilterSelect value={categoryFilter} onValueChange={v => setCategory(v as CategoryFilter)} width="w-[145px]">
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="task">Nur Aufgaben</SelectItem>
              <SelectItem value="finding">Nur Befunde</SelectItem>
            </FilterSelect>

            <FilterSelect value={dueFilter} onValueChange={v => setDue(v as DueFilter)} width="w-[155px]">
              <SelectItem value="all">Alle Fristen</SelectItem>
              <SelectItem value="overdue">Überfällig</SelectItem>
              <SelectItem value="today">Heute fällig</SelectItem>
              <SelectItem value="this-week">Diese Woche</SelectItem>
              <SelectItem value="this-month">Dieser Monat</SelectItem>
            </FilterSelect>

            <FilterSelect value={groupBy} onValueChange={v => setGroup(v as GroupBy)} width="w-[155px]">
              <SelectItem value="status">Nach Status</SelectItem>
              <SelectItem value="due-date">Nach Fälligkeit</SelectItem>
              <SelectItem value="auditor">Nach Auditor</SelectItem>
              <SelectItem value="client">Nach Kunde</SelectItem>
              <SelectItem value="audit">Nach Audit</SelectItem>
              <SelectItem value="none">Keine Gruppierung</SelectItem>
            </FilterSelect>

            <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3"
              onClick={() => setSort(sortDir === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'asc' ? 'Fälligkeit aufsteigend' : 'Fälligkeit absteigend'}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-xs">{sortDir === 'asc' ? 'Aufsteigend' : 'Absteigend'}</span>
            </Button>

            <Button
              variant={advancedFilterCount > 0 ? 'default' : 'outline'}
              size="sm" className="h-9 gap-1.5 px-3"
              onClick={() => setAdvancedOpen(o => !o)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-xs">Filter</span>
              {advancedFilterCount > 0 && (
                <span className="ml-0.5 text-xs bg-background/20 rounded-full px-1.5 py-0.5 leading-none">
                  {advancedFilterCount}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9" onClick={handleReset}>
                <X className="h-4 w-4 mr-1.5" />Zurücksetzen
              </Button>
            )}
          </div>

          {/* Advanced filters */}
          {advancedOpen && (
            <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-border/50">
              <FilterSelect value={consultantFilter || 'all'} onValueChange={v => setConsultant(v === 'all' ? '' : v)} width="w-[175px]">
                <SelectItem value="all">Alle Berater</SelectItem>
                {uniqueConsultants.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </FilterSelect>

              <FilterSelect value={auditorFilter || 'all'} onValueChange={v => setAuditor(v === 'all' ? '' : v)} width="w-[175px]">
                <SelectItem value="all">Alle Auditoren</SelectItem>
                {uniqueAuditors.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </FilterSelect>

              <ClientFilterCombobox value={clientFilter} onValueChange={setClient} clients={uniqueClients} />

              <FilterSelect value={auditTypeFilter || 'all'} onValueChange={v => setAuditType(v === 'all' ? '' : v)} width="w-[170px]">
                <SelectItem value="all">Alle Audit-Typen</SelectItem>
                {Object.entries(AUDIT_TYPE_LABELS).map(([val, lbl]) => <SelectItem key={val} value={val}>{lbl}</SelectItem>)}
              </FilterSelect>

              <FilterSelect value={severityFilter || 'all'} onValueChange={v => setSeverity(v === 'all' ? '' : v)} width="w-[165px]">
                <SelectItem value="all">Alle Schweregrade</SelectItem>
                <SelectItem value="major">Haupt-NK</SelectItem>
                <SelectItem value="minor">Neben-NK</SelectItem>
                <SelectItem value="recommendation">Empfehlung</SelectItem>
              </FilterSelect>

              <FilterSelect value={assignedFilter || 'all'} onValueChange={v => setAssigned(v === 'all' ? '' : v)} width="w-[170px]">
                <SelectItem value="all">Alle Zuständigen</SelectItem>
                {activeConsultants.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </FilterSelect>
            </div>
          )}

          {/* Status tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setStatus(tab.value)}
                className={cn(
                  'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                  statusFilter === tab.value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className={cn('flex-1 overflow-auto p-4 md:p-6 lg:px-8 transition-opacity duration-150', isPending && 'opacity-50')}>
        {isLoading ? <TasksSkeleton /> : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckSquare className="h-14 w-14 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium mb-1">Keine Aufgaben gefunden</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={handleReset} className="text-muted-foreground">
                Filter zurücksetzen
              </Button>
            )}
          </div>
        ) : (
          <div>
            {groups.map(({ label, tasks: gt }) => (
              <TaskGroup
                key={label} label={label} tasks={gt}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onComplete={handleComplete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk-Aktionsleiste */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 z-20 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'Aufgabe' : 'Aufgaben'} ausgewählt
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="secondary"
              className="h-8 gap-1.5"
              onClick={handleBulkComplete}
              disabled={updateTask.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Als erledigt markieren
            </Button>
            <Button size="sm" variant="ghost"
              className="h-8 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setSelectedIds(new Set())}
            >
              Auswahl aufheben
            </Button>
          </div>
        </div>
      )}

      <EditFindingDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={editTask}
        defaultAssignedTo={editTask?.audits?.clients?.consultants?.name || ''}
      />
    </div>
  );
}
