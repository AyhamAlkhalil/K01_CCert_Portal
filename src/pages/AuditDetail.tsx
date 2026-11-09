import { useState, useCallback, useEffect, memo, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudit, useUpdateAudit, useDeleteAudit } from '@/hooks/useAudits';
import { useAuditTasks, useUpdateAuditTask, useDeleteAuditTask } from '@/hooks/useAuditTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
  Users,
  User,
  FileText,
  CalendarPlus,
  ChevronRight,
  ChevronDown,
  Pencil,
  XCircle,
  Plus,
  AlertTriangle,
  Trash2,
  CalendarDays,
  Paperclip,
  Upload,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AuditTask } from '@/types/audit';
import { AUDIT_TYPE_LABELS, AUDIT_STATUS_CONFIG, TASK_STATUS_CONFIG } from '@/lib/constants';
import { isOverdue } from '@/lib/dateUtils';
import { DbAuditTask } from '@/hooks/useAuditTasks';
import { EditAuditDialog } from '@/components/EditAuditDialog';
import { NewFindingDialog } from '@/components/NewFindingDialog';
import { EditFindingDialog } from '@/components/EditFindingDialog';
import { FindingsCsvUpload } from '@/components/FindingsCsvUpload';
import { AuditDocumentsCard } from '@/components/AuditDocumentsCard';
import { useOutlookSync } from '@/hooks/useOutlookSync';
import {
  useAuditTaskDocuments,
  useUploadAuditTaskDocument,
  useDeleteAuditTaskDocument,
  getAuditTaskDocumentUrl,
} from '@/hooks/useAuditTaskDocuments';

const StatusIcon = {
  scheduled: Clock,
  'in-progress': AlertCircle,
  completed: CheckCircle2,
  cancelled: AlertCircle,
};

const SEVERITY_LABELS: Record<string, string> = {
  major: 'Haupt-NK',
  minor: 'Neben-NK',
  recommendation: 'Empfehlung',
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const SEVERITY_COLORS: Record<string, string> = {
  major: 'bg-destructive/[0.12] text-destructive border-destructive/30',
  minor: 'bg-warning/[0.12] text-warning border-warning/30',
  recommendation: 'bg-info/[0.12] text-info border-info/30',
};

const ACCEPTED_TASK_DOC_TYPES = [
  '.pdf', '.txt', '.csv',
  '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.webp',
  '.doc', '.docx',
].join(',');

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TaskDocumentsSection = ({ taskId }: { taskId: string }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: documents = [], isLoading } = useAuditTaskDocuments(taskId);
  const upload = useUploadAuditTaskDocument();
  const remove = useDeleteAuditTaskDocument();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    for (const file of files) {
      try {
        await upload.mutateAsync({ taskId, file });
        toast.success(`${file.name} hochgeladen`);
      } catch {
        toast.error(`Fehler beim Hochladen von ${file.name}`);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getAuditTaskDocumentUrl(filePath);
    if (!url) { toast.error('Download-Link konnte nicht erstellt werden'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const handleDelete = (id: string, filePath: string) => {
    remove.mutate(
      { id, filePath, taskId },
      {
        onSuccess: () => toast.success('Dokument gelöscht'),
        onError: () => toast.error('Fehler beim Löschen'),
      }
    );
  };

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Dokumente</span>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TASK_DOC_TYPES}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2 gap-1"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="h-3 w-3" />
            {upload.isPending ? 'Lädt...' : 'Hochladen'}
          </Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-2">Lädt...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">Noch keine Dokumente</p>
      ) : (
        <ul className="space-y-1">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 p-2 rounded border bg-background text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{doc.file_name}</span>
              <span className="text-muted-foreground shrink-0">{formatFileSize(doc.file_size)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => handleDownload(doc.file_path, doc.file_name)}
                title="Herunterladen"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(doc.id, doc.file_path)}
                disabled={remove.isPending}
                title="Löschen"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface TaskItemProps {
  task: DbAuditTask & { category?: string; severity?: string | null };
  index: number;
  onToggle: (taskId: string, currentStatus: string) => void;
  onDelete: (taskId: string) => void;
  onEdit?: (task: DbAuditTask) => void;
  onSetCompletedAt?: (taskId: string, date: Date) => void;
  isUpdating: boolean;
  showSeverity?: boolean;
}

const TaskItem = memo(({ task, index, onToggle, onDelete, onEdit, onSetCompletedAt, isUpdating, showSeverity }: TaskItemProps) => {
  const dueDate = new Date(task.due_date);
  const taskOverdue = task.status !== 'completed' && isOverdue(dueDate);
  const displayStatus = taskOverdue ? TASK_STATUS_CONFIG.overdue : TASK_STATUS_CONFIG[task.status];
  const isFinding = task.category === 'finding';
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <div className="border border-border/70 rounded-xl hover:bg-accent/40 transition-colors">
    <div className="flex items-start gap-4 p-4">
      <Checkbox
        checked={task.status === 'completed'}
        onCheckedChange={() => onToggle(task.id, task.status)}
        disabled={isUpdating}
        className="mt-1"
      />
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className={cn(
              "font-medium",
              task.status === 'completed' && "line-through text-muted-foreground"
            )}>
              {index + 1}. {task.title}
            </p>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showSeverity && task.severity && (
              <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[task.severity] || ''}`}>
                {SEVERITY_LABELS[task.severity] || task.severity}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(displayStatus.bg, displayStatus.color)}
            >
              {displayStatus.label}
            </Badge>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                title="Bearbeiten"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(dueDate, 'dd.MM.yyyy', { locale: de })}
          </div>
          {task.assigned_to && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assigned_to}
            </div>
          )}
          {task.completed_at && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Erledigt: {format(new Date(task.completed_at), 'dd.MM.yyyy', { locale: de })}
            </div>
          )}
          {/* Date picker for findings to set manual completion date */}
          {isFinding && onSetCompletedAt && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2">
                  <CalendarDays className="h-3 w-3" />
                  {task.completed_at ? 'Datum ändern' : 'Erledigungsdatum'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={task.completed_at ? new Date(task.completed_at) : undefined}
                  onSelect={(date) => {
                    if (date) onSetCompletedAt(task.id, date);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 px-2 text-muted-foreground"
            onClick={() => setDocsOpen((v) => !v)}
          >
            <Paperclip className="h-3 w-3" />
            Dokumente
            <ChevronDown className={cn('h-3 w-3 transition-transform', docsOpen && 'rotate-180')} />
          </Button>
        </div>
      </div>
    </div>
      {docsOpen && (
        <div className="px-4 pb-4">
          <TaskDocumentsSection taskId={task.id} />
        </div>
      )}
    </div>
  );
});

TaskItem.displayName = 'TaskItem';

const AuditDetailSkeleton = () => (
  <>
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  </>
);

const AuditDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: audit, isLoading: auditLoading } = useAudit(id || '');
  const { data: allItems = [], isLoading: tasksLoading } = useAuditTasks(id);
  const updateTask = useUpdateAuditTask();
  const deleteTask = useDeleteAuditTask();
  const updateAudit = useUpdateAudit();
  const deleteAudit = useDeleteAudit();
  const { syncSingleAudit } = useOutlookSync();

  const [notes, setNotes] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showNewFindingDialog, setShowNewFindingDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<DbAuditTask | null>(null);

  // Separate tasks and findings
  const tasks = useMemo(() =>
    allItems.filter((t: DbAuditTask) => !t.category || t.category === 'task'),
    [allItems]
  );

  const findings = useMemo(() =>
    allItems.filter((t: DbAuditTask) => t.category === 'finding'),
    [allItems]
  );

  // Update notes when audit loads
  useEffect(() => {
    if (audit?.notes) {
      setNotes(audit.notes);
    }
  }, [audit?.notes]);

  const toggleTaskStatus = useCallback((taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    updateTask.mutate({
      id: taskId,
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    });
  }, [updateTask]);

  const handleDeleteTask = useCallback((taskId: string) => {
    deleteTask.mutate({ id: taskId, audit_id: id! }, {
      onSuccess: () => toast.success('Eintrag gelöscht'),
      onError: () => toast.error('Fehler beim Löschen'),
    });
  }, [deleteTask]);

  const handleSetCompletedAt = useCallback((taskId: string, date: Date) => {
    updateTask.mutate({
      id: taskId,
      completed_at: date.toISOString(),
      status: 'completed',
    }, {
      onSuccess: () => toast.success('Erledigungsdatum gesetzt'),
      onError: () => toast.error('Fehler beim Setzen des Datums'),
    });
  }, [updateTask]);

  const handleExportCalendar = useCallback(async () => {
    if (!audit) return;

    const result = await syncSingleAudit({
      id: audit.id,
      clientName: audit.clients?.name || 'Unbekannt',
      type: audit.type,
      scheduledDate: audit.scheduled_date,
      certifications: [],
      notes: audit.notes || undefined,
    });

    if (result.success) {
      return;
    }

    toast.error('Kein Outlook-Kalender verbunden.');
  }, [audit, syncSingleAudit]);

  const handleSaveNotes = useCallback(async () => {
    if (audit && id) {
      try {
        await updateAudit.mutateAsync({ id, notes });
        toast.success('Notizen wurden aktualisiert.');
      } catch (error) {
        toast.error('Notizen konnten nicht gespeichert werden.');
      }
    }
  }, [audit, id, notes, updateAudit]);

  const handleCancelAudit = useCallback(async () => {
    if (audit && id) {
      try {
        await updateAudit.mutateAsync({ id, status: 'cancelled' });
        toast.success('Das Audit wurde als abgebrochen markiert.');
      } catch (error) {
        toast.error('Audit konnte nicht abgebrochen werden.');
      }
    }
  }, [audit, id, updateAudit]);

  const handleDeleteAudit = useCallback(async () => {
    if (id) {
      try {
        await deleteAudit.mutateAsync(id);
        toast.success('Audit wurde gelöscht.');
        navigate(-1);
      } catch (error) {
        toast.error('Audit konnte nicht gelöscht werden.');
      }
    }
  }, [id, deleteAudit, navigate]);

  if (auditLoading || tasksLoading) {
    return <AuditDetailSkeleton />;
  }

  if (!audit) {
    return (
      <>
        <div className="p-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Audit nicht gefunden</p>
            <Button onClick={() => navigate('/audits')} className="mt-4">
              Zurück zu Audits
            </Button>
          </div>
        </div>
      </>
    );
  }

  const statusInfo = AUDIT_STATUS_CONFIG[audit.status];
  const Icon = StatusIcon[audit.status];

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const openFindings = findings.filter(f => f.status !== 'completed').length;

  // Get certification name for breadcrumb
  const certificationName = audit.client_certifications?.certifications?.name || null;

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        {/* Back Navigation + Breadcrumb */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
            title="Zurück"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <nav className="flex items-center text-sm text-muted-foreground overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/clients')}
              className="text-muted-foreground hover:text-foreground px-2"
            >
              Kunden
            </Button>
            <ChevronRight className="h-4 w-4 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/clients/${audit.client_id}`)}
              className="text-muted-foreground hover:text-foreground px-2"
            >
              {audit.clients?.name || 'Unbekannt'}
            </Button>
            {certificationName && audit.client_certification_id && (
              <>
                <ChevronRight className="h-4 w-4 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/certifications/${audit.client_certification_id}`)}
                  className="text-muted-foreground hover:text-foreground px-2"
                >
                  {certificationName}
                </Button>
              </>
            )}
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium text-foreground px-2">
              {AUDIT_TYPE_LABELS[audit.type]}
            </span>
          </nav>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.01em] text-foreground sm:text-[30px]">{AUDIT_TYPE_LABELS[audit.type]}</h1>
            <p className="mt-1 text-muted-foreground text-sm tabular-nums">
              {format(new Date(audit.scheduled_date), 'dd.MM.yyyy', { locale: de })}
            </p>
          </div>
          <Badge
            variant={statusInfo.variant}
            className={cn('flex items-center gap-1.5 self-start text-[13px] px-3 py-1 sm:self-auto', statusInfo.className)}
          >
            <Icon className="h-3.5 w-3.5" />
            {statusInfo.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            <Card>
              <CardHeader>
                <CardTitle>Fortschritt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                    {completedTasks} / {totalTasks}
                  </span>
                  <span className="text-sm text-muted-foreground">Aufgaben abgeschlossen</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tasks Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Aufgaben</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowNewTaskDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Aufgabe
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Keine Aufgaben definiert
                  </p>
                ) : (
                  tasks.map((task, index) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      index={index}
                      onToggle={toggleTaskStatus}
                      onDelete={handleDeleteTask}
                      onEdit={setEditingTask}
                      isUpdating={updateTask.isPending}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Findings / NK Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Feststellungen / NK</CardTitle>
                  {openFindings > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {openFindings} offen
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <FindingsCsvUpload auditId={id!} />
                  <Button size="sm" variant="outline" onClick={() => setShowNewFindingDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    NK hinzufügen
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {findings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Keine Feststellungen erfasst</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Nichtkonformitäten und Empfehlungen aus dem Audit hier erfassen
                    </p>
                  </div>
                ) : (
                  findings.map((finding, index) => (
                    <TaskItem
                      key={finding.id}
                      task={finding}
                      index={index}
                      onToggle={toggleTaskStatus}
                      onDelete={handleDeleteTask}
                      onEdit={setEditingTask}
                      onSetCompletedAt={handleSetCompletedAt}
                      isUpdating={updateTask.isPending}
                      showSeverity
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Notes Card */}
            <Card>
              <CardHeader>
                <CardTitle>Notizen</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notizen zum Audit hinzufügen..."
                  className="min-h-32"
                />
                <Button
                  className="mt-4"
                  onClick={handleSaveNotes}
                  disabled={updateAudit.isPending}
                >
                  {updateAudit.isPending ? 'Speichert...' : 'Notizen speichern'}
                </Button>
              </CardContent>
            </Card>

            {/* Documents Card */}
            <AuditDocumentsCard auditId={id!} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Audit Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Audit-Informationen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">{audit.clients?.name || 'Unbekannt'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {format(new Date(audit.scheduled_date), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{AUDIT_TYPE_LABELS[audit.type]}</span>
                  </div>
                </div>

                {audit.client_certifications?.certifications && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Zertifizierung
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {audit.client_certifications.certifications.name}
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Erstellt am
                  </p>
                  <p className="text-sm text-foreground">
                    {format(new Date(audit.created_at), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Aktionen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleExportCalendar}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Zu Outlook hinzufügen
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowEditDialog(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Audit bearbeiten
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                  title="Berichtsfunktion derzeit nicht verfügbar"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Bericht generieren
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={audit.status === 'cancelled'}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {audit.status === 'cancelled' ? 'Bereits abgebrochen' : 'Audit abbrechen'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Audit abbrechen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Möchten Sie dieses Audit wirklich abbrechen? Diese Aktion kann nicht rückgängig gemacht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Nein, behalten</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelAudit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Ja, abbrechen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Audit löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Audit endgültig löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Das Audit und alle zugehörigen Aufgaben und Befunde werden unwiderruflich gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAudit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Ja, endgültig löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs */}
        <EditAuditDialog
          audit={audit}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
        <NewFindingDialog
          open={showNewTaskDialog}
          onOpenChange={setShowNewTaskDialog}
          auditId={id!}
          category="task"
          defaultAssignedTo={audit?.clients?.consultants?.name || ''}
        />
        <NewFindingDialog
          open={showNewFindingDialog}
          onOpenChange={setShowNewFindingDialog}
          auditId={id!}
          category="finding"
          defaultAssignedTo={audit?.clients?.consultants?.name || ''}
        />
        <EditFindingDialog
          open={!!editingTask}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          task={editingTask}
          defaultAssignedTo={audit?.clients?.consultants?.name || ''}
        />
      </div>
    </>
  );
};

export default AuditDetail;
