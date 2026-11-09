import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Popover,

  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarIcon } from 'lucide-react';
import { format, parse, isValid, isMatch, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useUpdateAudit, AuditWithClient } from '@/hooks/useAudits';
import { useAuditors } from '@/hooks/useAuditors';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { useAuditTasks, useUpdateAuditTask } from '@/hooks/useAuditTasks';
import { formatAuditorName, sortAuditorsByLastName } from '@/lib/auditorUtils';
import { toast } from 'sonner';
import { AUDIT_STATUS_CONFIG } from '@/lib/constants';
import { addDays } from 'date-fns';
import { parseGermanDate } from '@/lib/dateUtils';

interface EditAuditDialogProps {
  audit: AuditWithClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AUDIT_STATUSES = [
  { value: 'scheduled', label: 'Geplant' },
  { value: 'in-progress', label: 'In Bearbeitung' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Abgebrochen' },
] as const;

export function EditAuditDialog({ audit, open, onOpenChange }: EditAuditDialogProps) {
  const updateAudit = useUpdateAudit();
  const { data: auditors = [] } = useAuditors();
  const { data: certificationBodies = [] } = useCertificationBodies();
  const { data: auditTasks = [] } = useAuditTasks(audit?.id);
  const updateTask = useUpdateAuditTask();

  const [dateInput, setDateInput] = useState<string>('');
  const [originalDate, setOriginalDate] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<string>('scheduled');
  const [auditorId, setAuditorId] = useState<string>('__none__');
  const [certificationBodyId, setCertificationBodyId] = useState<string>('__none__');

  // Reset form only when a different audit is opened (keyed by audit.id)
  useEffect(() => {
    if (audit) {
      const d = new Date(audit.scheduled_date);
      setDateInput(format(d, 'dd.MM.yyyy'));
      setOriginalDate(d);
      setStatus(audit.status);
      setAuditorId(audit.auditor_id || '__none__');
      setCertificationBodyId(audit.certification_body_id || '__none__');
    }
  }, [audit?.id]);


  const sortedAuditors = sortAuditorsByLastName(auditors);

  const handleSave = async () => {
    if (!audit || !dateInput) {
      toast.error('Bitte geben Sie ein Datum an.');
      return;
    }

    try {
      const parsedDate = parseGermanDate(dateInput);

      if (!parsedDate) {
        toast.error('Bitte geben Sie ein gültiges Datum ein (z.B. 22.03.2026)');
        return;
      }

      const daysDiff = originalDate ? differenceInCalendarDays(parsedDate, originalDate) : 0;

      await updateAudit.mutateAsync({
        id: audit.id,
        scheduled_date: parsedDate.toISOString(),
        status: status as 'scheduled' | 'in-progress' | 'completed' | 'cancelled',
        auditor_id: auditorId === '__none__' ? null : auditorId,
        certification_body_id: certificationBodyId === '__none__' ? null : certificationBodyId,
      });

      // Shift task due dates if audit date changed
      if (daysDiff !== 0 && auditTasks.length > 0) {
        await Promise.all(
          auditTasks.map((task) =>
            updateTask.mutateAsync({
              id: task.id,
              due_date: addDays(new Date(task.due_date), daysDiff).toISOString(),
            })
          )
        );
        toast.success(`Audit und ${auditTasks.length} Aufgaben-Fristen aktualisiert.`);
      } else {
        toast.success('Audit wurde erfolgreich aktualisiert.');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating audit:', error);
      toast.error('Audit konnte nicht aktualisiert werden.');
    }
  };


  if (!audit) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Audit bearbeiten</DialogTitle>
          <DialogDescription>
            Ändern Sie Datum, Status und Auditor für dieses Audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Scheduled Date */}
          <div className="space-y-2">
            <Label>Auditdatum *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="TT.MM.JJJJ"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
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
                    captionLayout="dropdown"
                    fromYear={2020}
                    toYear={2035}
                    selected={
                      isMatch(dateInput, 'dd.MM.yyyy') ? parse(dateInput, 'dd.MM.yyyy', new Date()) :
                      isMatch(dateInput, 'yyyy-MM-dd') ? parse(dateInput, 'yyyy-MM-dd', new Date()) :
                      undefined
                    }
                    onSelect={(date) => {
                      if (date) {
                        setDateInput(format(date, 'dd.MM.yyyy'));
                      }
                    }}
                    initialFocus
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {originalDate && dateInput && isMatch(dateInput, 'dd.MM.yyyy') && (
              (() => {
                const parsed = parse(dateInput, 'dd.MM.yyyy', new Date());
                const diff = differenceInCalendarDays(parsed, originalDate);
                if (diff !== 0 && auditTasks.length > 0) {
                  return (
                    <p className="text-xs text-warning bg-warning/5 p-2 rounded-lg border border-warning/20 mt-2 flex items-center gap-2">
                      <CalendarIcon className="h-3 w-3" />
                      Hinweis: {auditTasks.length} Aufgabenfristen werden automatisch um {Math.abs(diff)} Tage {diff > 0 ? 'nach hinten' : 'nach vorne'} verschoben.
                    </p>
                  );
                }
                return null;
              })()
            )}
          </div>


          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status wählen..." />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auditor */}
          <div className="space-y-2">
            <Label>Auditor</Label>
            <Select value={auditorId} onValueChange={setAuditorId}>
              <SelectTrigger>
                <SelectValue placeholder="Auditor wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Kein Auditor —</SelectItem>
                {sortedAuditors.map((auditor) => (
                  <SelectItem key={auditor.id} value={auditor.id}>
                    {formatAuditorName(auditor.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Certification Body */}
          <div className="space-y-2">
            <Label>Zertifizierer</Label>
            <Select value={certificationBodyId} onValueChange={setCertificationBodyId}>
              <SelectTrigger>
                <SelectValue placeholder="Zertifizierer wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Kein Zertifizierer —</SelectItem>
                {certificationBodies.map((body) => (
                  <SelectItem key={body.id} value={body.id}>
                    {body.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={updateAudit.isPending}>
            {updateAudit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  );
}
