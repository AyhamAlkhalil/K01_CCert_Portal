import { useState, useMemo } from 'react';
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
import { useClients, CertificationStandard } from '@/hooks/useClients';
import { useCreateAudit, AuditType } from '@/hooks/useAudits';
import { useCreateBulkAuditTasks, useAllAuditTasks, DbAuditTaskFull, DbAuditTaskInsert } from '@/hooks/useAuditTasks';
import { useCertifications } from '@/hooks/useCertifications';
import { useCreateClientCertification, useAllClientCertifications } from '@/hooks/useClientCertifications';
import { useAuditors } from '@/hooks/useAuditors';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { AUDIT_TYPE_LABELS } from '@/lib/constants';
import { daysFromNow, parseGermanDate } from '@/lib/dateUtils';
import { AlertTriangle, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { format, parse, isValid, isMatch, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';


interface NewAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const auditTypeOptions: { value: AuditType; label: string }[] = [
  { value: 'initial', label: AUDIT_TYPE_LABELS['initial'] },
  { value: 'surveillance', label: AUDIT_TYPE_LABELS['surveillance'] },
  { value: 'recertification', label: AUDIT_TYPE_LABELS['recertification'] },
  { value: 'six-month', label: AUDIT_TYPE_LABELS['six-month'] },
  { value: 'internal', label: AUDIT_TYPE_LABELS['internal'] },
  { value: 'training', label: AUDIT_TYPE_LABELS['training'] },
];

const SEVERITY_LABELS: Record<string, string> = {
  major: 'Haupt-NK',
  minor: 'Neben-NK',
  recommendation: 'Empfehlung',
};

const SEVERITY_COLORS: Record<string, string> = {
  major: 'bg-destructive/10 text-destructive border-destructive/20',
  minor: 'bg-warning/10 text-warning border-warning/20',
  recommendation: 'bg-info/10 text-info border-info/20',
};

const getDefaultTasksForAuditType = (type: AuditType, scheduledDate: Date) => {
  const taskTemplates: Record<AuditType, Array<{ title: string; description: string; dueDays: number; assignedTo: string }>> = {
    initial: [
      { title: 'Registrierung beim Zertifizierer', description: 'Registrierung beim Zertifizierer und im SURE-EU-System durchführen', dueDays: -20, assignedTo: 'Auditor' },
      { title: 'Training und Dokumentation', description: 'Schulung der Mitarbeiter durchführen und vollständige Dokumentation erstellen', dueDays: -2, assignedTo: 'Auditor' },
      { title: 'Systemaudit und Umsetzung', description: 'Vollständiges Systemaudit durchführen und Umsetzung der Standards prüfen', dueDays: 2, assignedTo: 'Auditor' },
    ],
    surveillance: [
      { title: 'Zusendung der Unterlagen', description: 'Alle relevanten Unterlagen für die interne Überprüfung zusenden', dueDays: 1, assignedTo: 'Auditor' },
      { title: 'Austausch und Korrektur', description: 'Feedback vom Zertifizierer besprechen und notwendige Korrekturen durchführen', dueDays: 8, assignedTo: 'Auditor' },
    ],
    recertification: [
      { title: 'Vorbereitung Re-System audit', description: 'Alle Dokumente aktualisieren und für Re-System audit vorbereiten', dueDays: 20, assignedTo: 'Auditor' },
      { title: 'Interne Überprüfung', description: 'Internes Audit zur Sicherstellung der Standards durchführen', dueDays: 35, assignedTo: 'Auditor' },
      { title: 'Re-System audit', description: 'Vollständiges Re-System audit durchführen', dueDays: 42, assignedTo: 'Auditor' },
    ],
    'six-month': [
      { title: 'Statusbericht erstellen', description: '6-Monats-Bericht über die Umsetzung der Systemanforderungen erstellen', dueDays: 5, assignedTo: 'Auditor' },
      { title: 'Dokumentation prüfen', description: 'Vollständigkeit und Aktualität der Dokumentation überprüfen', dueDays: 15, assignedTo: 'Auditor' },
    ],
    internal: [
      { title: 'Internes Audit vorbereiten', description: 'Prüfplan erstellen und Dokumente zusammenstellen', dueDays: -7, assignedTo: 'Berater' },
      { title: 'Internes Audit durchführen', description: 'Interne Prüfung der Prozesse und Dokumentation durchführen', dueDays: 0, assignedTo: 'Berater' },
      { title: 'Bericht erstellen', description: 'Ergebnisse dokumentieren und Maßnahmenplan erstellen', dueDays: 7, assignedTo: 'Berater' },
    ],
    training: [
      { title: 'Trainingsunterlagen vorbereiten', description: 'Präsentationen und Handouts für das Training erstellen', dueDays: -7, assignedTo: 'Berater' },
      { title: 'Training durchführen', description: 'Schulung der Mitarbeiter vor Ort oder Remote durchführen', dueDays: 0, assignedTo: 'Berater' },
      { title: 'Teilnahmebescheinigungen ausstellen', description: 'Zertifikate für die Teilnehmer erstellen und versenden', dueDays: 3, assignedTo: 'Berater' },
    ],
  };

  return taskTemplates[type].map((task) => ({
    title: task.title,
    description: task.description,
    due_date: daysFromNow(task.dueDays).toISOString(),
    assigned_to: task.assignedTo,
    status: 'pending' as const,
  }));
};

export const NewAuditDialog = ({ open, onOpenChange }: NewAuditDialogProps) => {
  const [selectedClient, setSelectedClient] = useState('');
  const [auditType, setAuditType] = useState<AuditType>('initial');
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [auditorId, setAuditorId] = useState<string>('');
  const [certificationBodyId, setCertificationBodyId] = useState<string>('');
  const [nkListOpen, setNkListOpen] = useState(false);
  const [selectedNks, setSelectedNks] = useState<string[]>([]);

  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: certifications = [] } = useCertifications();
  const { data: allTasks = [] } = useAllAuditTasks();
  const { data: auditors = [] } = useAuditors();
  const { data: certificationBodies = [] } = useCertificationBodies();
  const createAudit = useCreateAudit();
  const createTasks = useCreateBulkAuditTasks();

  const sortedClients = useMemo(() =>
    [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  // Open findings for selected client
  const openFindings = useMemo(() => {
    if (!selectedClient) return [];
    return (allTasks as DbAuditTaskFull[]).filter((t) =>
      t.category === 'finding' &&
      t.status !== 'completed' &&
      t.audits?.client_id === selectedClient
    );
  }, [allTasks, selectedClient]);

  const openFindingsSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of openFindings) {
      const sev = f.severity || 'unknown';
      counts[sev] = (counts[sev] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([sev, count]) => `${count} ${SEVERITY_LABELS[sev] || sev}`)
      .join(', ');
  }, [openFindings]);

  const toggleCertification = (certName: string) => {
    setSelectedCertifications(prev =>
      prev.includes(certName)
        ? prev.filter(c => c !== certName)
        : [...prev, certName]
    );
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

  const resetForm = () => {
    setSelectedClient('');
    setAuditType('initial');
    setSelectedCertifications([]);
    setScheduledDate('');
    setNotes('');
    setAuditorId('');
    setCertificationBodyId('');
    setNkListOpen(false);
    setSelectedNks([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient || !scheduledDate || selectedCertifications.length === 0) {
      toast.error('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    try {
      const parsedDate = parseGermanDate(scheduledDate);

      if (!parsedDate) {
        toast.error('Bitte geben Sie ein gültiges Datum ein (z.B. 22.03.2026)');
        return;
      }

      const audit = await createAudit.mutateAsync({
        client_id: selectedClient,
        type: auditType,
        scheduled_date: parsedDate.toISOString(),
        notes: notes || null,
        status: 'scheduled',
        auditor_id: auditorId || null,
        certification_body_id: certificationBodyId || null,
      });

      const defaultTasks = getDefaultTasksForAuditType(auditType, parsedDate);
      const tasksToCreate: DbAuditTaskInsert[] = defaultTasks.map(task => ({
        ...task,
        audit_id: audit.id,
      }));

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

      await createTasks.mutateAsync(tasksToCreate);

      toast.success(`Audit erfolgreich erstellt${selectedNks.length > 0 ? ` (${selectedNks.length} NK übernommen)` : ''}`);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating audit:', error);
      toast.error('Fehler beim Erstellen des Audits');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Audit erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie ein neues Audit für einen bestehenden Kunden
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Kunde *</Label>
            <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedNks([]); }}>
              <SelectTrigger id="client">
                <SelectValue placeholder={clientsLoading ? 'Lade Kunden...' : 'Kunde auswählen'} />
              </SelectTrigger>
              <SelectContent>
                {sortedClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Open NK Warning with checkboxes */}
          {openFindings.length > 0 && (
            <Collapsible open={nkListOpen} onOpenChange={setNkListOpen}>
              <CollapsibleTrigger asChild>
                <Alert variant="destructive" className="cursor-pointer hover:bg-destructive/10 transition-colors">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between w-full">
                    <span>
                      <span className="font-medium">
                        {openFindings.length} offene NK aus früheren Audits
                      </span>
                      {openFindingsSummary && (
                        <span className="text-sm ml-1">({openFindingsSummary})</span>
                      )}
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

          {/* Certifications */}
          <div className="space-y-2">
            <Label>Zertifizierungen *</Label>
            <div className="grid grid-cols-2 gap-3 p-4 border rounded-lg max-h-60 overflow-y-auto">
              {certifications.map((cert) => (
                <div key={cert.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cert-${cert.id}`}
                    checked={selectedCertifications.includes(cert.name)}
                    onCheckedChange={() => toggleCertification(cert.name)}
                  />
                  <label
                    htmlFor={`cert-${cert.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {cert.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

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
            <p className="text-[10px] text-muted-foreground mt-1">
              Tipp: Datum manuell eingeben (z.B. 22.03.31) oder Kalender nutzen
            </p>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auditor */}
            <div className="space-y-2">
              <Label htmlFor="auditor">Auditor</Label>
              <Select value={auditorId} onValueChange={setAuditorId}>
                <SelectTrigger id="auditor">
                  <SelectValue placeholder="Auditor wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Auditor —</SelectItem>
                  {auditors.map((auditor) => (
                    <SelectItem key={auditor.id} value={auditor.id}>
                      {auditor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Certification Body */}
            <div className="space-y-2">
              <Label htmlFor="cert-body">Zertifizierer</Label>
              <Select value={certificationBodyId} onValueChange={setCertificationBodyId}>
                <SelectTrigger id="cert-body">
                  <SelectValue placeholder="Zertifizierer wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Zertifizierer —</SelectItem>
                  {certificationBodies.map((body) => (
                    <SelectItem key={body.id} value={body.id}>
                      {body.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: Zusätzliche Informationen zum Audit..."
              className="min-h-24"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createAudit.isPending || createTasks.isPending}>
              {createAudit.isPending || createTasks.isPending ? 'Erstelle...' : 'Audit erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
