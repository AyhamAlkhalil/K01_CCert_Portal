import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { 
  useCreateCertificationAudit, 
  useUpdateCertificationAudit,
  CertificationAudit,
  AuditType,
  AuditStatus
} from '@/hooks/useCertificationAudits';
import { useAuditors } from '@/hooks/useAuditors';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { useCreateBulkAuditTasks, useAllAuditTasks, DbAuditTaskInsert } from '@/hooks/useAuditTasks';
import { fetchTemplateTasksForAudit } from '@/hooks/useAuditTemplates';
import { Tables } from '@/integrations/supabase/types';
import { AUDIT_TYPE_LABELS } from '@/lib/constants';
import { parseGermanDate } from '@/lib/dateUtils';
import { addDays, format, parse, isValid, isMatch } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

interface CertificationAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientCertificationId: string;
  clientId: string;
  certificationId: string;
  certificationName: string;
  existingAudit?: CertificationAudit | null;
  presetType?: string | null;
  presetDate?: string | null;
}

const AUDIT_STATUS_OPTIONS: { value: AuditStatus; label: string }[] = [
  { value: 'scheduled', label: 'Geplant' },
  { value: 'in-progress', label: 'In Bearbeitung' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Abgebrochen' },
];

const auditTypeOptions: { value: AuditType; label: string }[] = [
  { value: 'initial', label: AUDIT_TYPE_LABELS['initial'] },
  { value: 'surveillance', label: AUDIT_TYPE_LABELS['surveillance'] },
  { value: 'recertification', label: AUDIT_TYPE_LABELS['recertification'] },
  { value: 'six-month', label: AUDIT_TYPE_LABELS['six-month'] },
  { value: 'internal', label: AUDIT_TYPE_LABELS['internal'] },
];

const SEVERITY_LABELS: Record<string, string> = {
  major: 'Haupt-NK',
  minor: 'Neben-NK',
  recommendation: 'Empfehlung',
};

const SEVERITY_COLORS: Record<string, string> = {
  major: 'bg-destructive/[0.12] text-destructive border-destructive/30',
  minor: 'bg-warning/[0.12] text-warning border-warning/30',
  recommendation: 'bg-info/[0.12] text-info border-info/30',
};

export const CertificationAuditDialog = ({ 
  open, 
  onOpenChange, 
  clientCertificationId,
  clientId,
  certificationId,
  certificationName,
  existingAudit,
  presetType,
  presetDate,
}: CertificationAuditDialogProps) => {
  const [auditType, setAuditType] = useState<AuditType>('initial');
  const [scheduledDate, setScheduledDate] = useState('');
  const [status, setStatus] = useState<AuditStatus>('scheduled');
  const [auditorId, setAuditorId] = useState<string>('');
  const [certificationBodyId, setCertificationBodyId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedNks, setSelectedNks] = useState<string[]>([]);
  const [nkListOpen, setNkListOpen] = useState(false);

  const { data: auditors = [] } = useAuditors();
  const { data: certificationBodies = [] } = useCertificationBodies();
  const { data: allTasks = [] } = useAllAuditTasks();
  const createAudit = useCreateCertificationAudit();
  const updateAudit = useUpdateCertificationAudit();
  const createTasks = useCreateBulkAuditTasks();

  const isEditMode = !!existingAudit;

  // Open findings for this specific client_certification_id
  const openFindings = useMemo(() => {
    if (isEditMode) return [];
    return allTasks.filter((t) =>
      t.category === 'finding' &&
      t.status !== 'completed' &&
      t.audits?.client_certification_id === clientCertificationId
    );
  }, [allTasks, clientCertificationId, isEditMode]);

  // Initialize form when dialog opens or existingAudit changes
  useEffect(() => {
    if (existingAudit) {
      setAuditType(existingAudit.type);
      setScheduledDate(existingAudit.scheduled_date.split('T')[0]);
      setStatus(existingAudit.status);
      setAuditorId(existingAudit.auditor_id || '');
      setCertificationBodyId(existingAudit.certification_body_id || '');
      setNotes(existingAudit.notes || '');
    } else {
      resetForm();
      if (presetType) {
        setAuditType(presetType as AuditType);
      }
      if (presetDate) {
        setScheduledDate(presetDate);
      }
    }
  }, [existingAudit, open, presetType, presetDate]);

  const resetForm = () => {
    setAuditType('initial');
    setScheduledDate('');
    setStatus('scheduled');
    setAuditorId('');
    setCertificationBodyId('');
    setNotes('');
    setSelectedNks([]);
    setNkListOpen(false);
  };

  const toggleNk = (id: string) => {
    setSelectedNks(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllNks = () => {
    if (selectedNks.length === openFindings.length) {
      setSelectedNks([]);
    } else {
      setSelectedNks(openFindings.map((f) => f.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!scheduledDate) {
      toast.error('Bitte geben Sie ein Datum an');
      return;
    }

    try {
      const parsedDate = parseGermanDate(scheduledDate);

      if (!parsedDate) {
        toast.error('Bitte geben Sie ein gültiges Datum ein (z.B. 22.03.2026)');
        return;
      }

      if (isEditMode && existingAudit) {
        await updateAudit.mutateAsync({
          id: existingAudit.id,
          type: auditType,
          scheduled_date: parsedDate.toISOString(),
          status,
          auditor_id: auditorId || null,
          certification_body_id: certificationBodyId || null,
          notes: notes || null,
        });
        toast.success('Audit erfolgreich aktualisiert');
      } else {
        const audit = await createAudit.mutateAsync({
          client_id: clientId,
          client_certification_id: clientCertificationId,
          type: auditType,
          scheduled_date: parsedDate.toISOString(),
          status,
          auditor_id: auditorId || null,
          certification_body_id: certificationBodyId || null,
          notes: notes || null,
        });

        // Load tasks from template
        const templateTasks = await fetchTemplateTasksForAudit(certificationId, auditType);
        
        const tasksToCreate: DbAuditTaskInsert[] = [];
        const auditDate = parsedDate;

        tasksToCreate.push(
          ...templateTasks.map(task => ({
            title: task.title,
            description: task.description || undefined,
            due_date: addDays(auditDate, -task.days_before_audit).toISOString(),
            assigned_to: 'Auditor',
            status: 'pending' as const,
            audit_id: audit.id,
          }))
        );

        // Copy selected NKs
        if (selectedNks.length > 0) {
          const nksToCopy = openFindings.filter((f) => selectedNks.includes(f.id));
          tasksToCreate.push(
            ...nksToCopy.map((f) => ({
              title: f.title,
              description: f.description || undefined,
              severity: f.severity || undefined,
              due_date: f.due_date,
              assigned_to: f.assigned_to || undefined,
              category: 'finding',
              status: 'pending' as const,
              audit_id: audit.id,
            }))
          );
        }

        if (tasksToCreate.length > 0) {
          await createTasks.mutateAsync(tasksToCreate);
        }

        toast.success(`Audit erfolgreich erstellt${selectedNks.length > 0 ? ` (${selectedNks.length} NK übernommen)` : ''}`);
      }
      
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving audit:', error);
      toast.error(isEditMode ? 'Fehler beim Aktualisieren des Audits' : 'Fehler beim Erstellen des Audits');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Audit bearbeiten' : 'Neues Audit erstellen'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? `Bearbeiten Sie das Audit für ${certificationName}` 
              : `Erstellen Sie ein neues Audit für ${certificationName}`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Audit Type */}
          <div className="space-y-2">
            <Label htmlFor="audit-type">Audit-Typ *</Label>
            <Select value={auditType} onValueChange={(value) => setAuditType(value as AuditType)}>
              <SelectTrigger id="audit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {auditTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Open NK Warning with checkboxes */}
          {!isEditMode && openFindings.length > 0 && (
            <Collapsible open={nkListOpen} onOpenChange={setNkListOpen}>
              <CollapsibleTrigger asChild>
                <Alert variant="destructive" className="cursor-pointer hover:bg-destructive/10 transition-colors">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between w-full">
                    <span className="font-medium">
                      {openFindings.length} offene NK aus früheren Audits
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${nkListOpen ? 'rotate-180' : ''}`} />
                  </AlertDescription>
                </Alert>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border rounded-lg mt-2 max-h-48 overflow-y-auto">
                  <div className="p-2 border-b flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={toggleAllNks}
                    >
                      {selectedNks.length === openFindings.length ? 'Keine auswählen' : 'Alle auswählen'}
                    </Button>
                    {selectedNks.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {selectedNks.length} ausgewählt
                      </span>
                    )}
                  </div>
                  <div className="divide-y">
                    {openFindings.map((f) => (
                      <div key={f.id} className="p-3 text-sm flex items-center gap-3">
                        <Checkbox
                          checked={selectedNks.includes(f.id)}
                          onCheckedChange={() => toggleNk(f.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{f.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <CalendarIcon className="h-3 w-3" />
                            <span>Frist: {format(new Date(f.due_date), 'dd.MM.yyyy', { locale: de })}</span>
                          </div>
                        </div>
                        {f.severity && (
                          <Badge variant="outline" className={`text-xs shrink-0 ${SEVERITY_COLORS[f.severity] || ''}`}>
                            {SEVERITY_LABELS[f.severity] || f.severity}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Scheduled Date */}
          <div className="space-y-2">
            <Label htmlFor="scheduled-date">Geplantes Datum *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="scheduled-date"
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 border-input">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="end">
                  <Calendar
                    mode="single"
                    selected={
                      isMatch(scheduledDate, 'dd.MM.yyyy') ? parse(scheduledDate, 'dd.MM.yyyy', new Date()) : 
                      isMatch(scheduledDate, 'yyyy-MM-dd') ? parse(scheduledDate, 'yyyy-MM-dd', new Date()) :
                      isMatch(scheduledDate.split('T')[0], 'yyyy-MM-dd') ? parse(scheduledDate.split('T')[0], 'yyyy-MM-dd', new Date()) :
                      undefined
                    }
                    onSelect={(date) => {
                      if (date) {
                        setScheduledDate(format(date, 'dd.MM.yyyy'));
                      }
                    }}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tipp: Datum manuell eingeben (z.B. 22.03.31) oder Kalender nutzen.
            </p>
          </div>


          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as AuditStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auditor */}
          <div className="space-y-2">
            <Label htmlFor="auditor">Auditor</Label>
            <Select value={auditorId || 'none'} onValueChange={(v) => setAuditorId(v === 'none' ? '' : v)}>
              <SelectTrigger id="auditor">
                <SelectValue placeholder="Auditor auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Auditor</SelectItem>
                {auditors.map((auditor) => (
                  <SelectItem key={auditor.id} value={auditor.id}>
                    {auditor.name}
                    {auditor.certification_bodies?.short_name && ` (${auditor.certification_bodies.short_name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Certification Body */}
          <div className="space-y-2">
            <Label htmlFor="cert-body">Zertifizierer</Label>
            <Select value={certificationBodyId || 'none'} onValueChange={(v) => setCertificationBodyId(v === 'none' ? '' : v)}>
              <SelectTrigger id="cert-body">
                <SelectValue placeholder="Zertifizierer auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Zertifizierer</SelectItem>
                {certificationBodies.map((body) => (
                  <SelectItem key={body.id} value={body.id}>
                    {body.short_name || body.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Informationen zum Audit..."
              className="min-h-20"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              type="submit" 
              disabled={createAudit.isPending || updateAudit.isPending || createTasks.isPending}
            >
              {(createAudit.isPending || updateAudit.isPending || createTasks.isPending) 
                ? 'Speichert...' 
                : isEditMode ? 'Speichern' : 'Audit erstellen'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
