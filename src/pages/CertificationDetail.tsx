import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useClientCertificationAuditSequences,
  useUpsertClientCertificationAuditSequences,
} from '@/hooks/useClientCertificationAuditSequences';
import { useCertificationAuditSequences } from '@/hooks/useCertificationAuditSequences';
import {
  useClientCertification,
  useUpdateClientCertification,
  useDeleteClientCertification
} from '@/hooks/useClientCertifications';
import { useClient } from '@/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useCertificationDocuments,
  useUploadCertificationDocument,
  useDeleteCertificationDocument,
  getDocumentUrl,
} from '@/hooks/useCertificationDocuments';
import { useAuditors } from '@/hooks/useAuditors';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { AuditorPopover } from '@/components/AuditorPopover';
import { CertificationAuditsList } from '@/components/CertificationAuditsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Award,
  Calendar,
  Building2,
  FileText,
  Upload,
  User,
  Users,
  Trash2,
  Download,
  Hash,
  Clock,
  AlertCircle,
  CheckCircle,
  ListOrdered,
  Plus,
  X as XIcon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AUDIT_TYPE_LABELS } from '@/lib/constants';
import { Database } from '@/integrations/supabase/types';

type AuditType = Database['public']['Enums']['audit_type'];
type SequenceRow = { sequence_order: number; audit_type: AuditType; offset_months: number; label: string };

const SEQUENCE_AUDIT_TYPES: AuditType[] = ['initial', 'surveillance', 'recertification', 'six-month'];

function ClientSequenceCard({
  clientCertificationId,
  certificationId,
  clientId,
  validFrom,
}: {
  clientCertificationId: string;
  certificationId: string;
  clientId: string;
  validFrom: string | null;
}) {
  const { data: clientSeqs = [], isLoading: clientLoading } = useClientCertificationAuditSequences(clientCertificationId);
  const { data: globalSeqs = [] } = useCertificationAuditSequences(certificationId);
  const upsert = useUpsertClientCertificationAuditSequences(clientCertificationId);
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rows, setRows] = useState<SequenceRow[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [applying, setApplying] = useState(false);

  const hasClientSeqs = clientSeqs.length > 0;

  if (dialogOpen && !initialized && !clientLoading) {
    const source = hasClientSeqs ? clientSeqs : globalSeqs.map(s => ({ ...s, client_certification_id: clientCertificationId }));
    setRows(source.map(s => ({
      sequence_order: s.sequence_order,
      audit_type: s.audit_type,
      offset_months: s.offset_months,
      label: s.label ?? '',
    })));
    setInitialized(true);
  }
  if (!dialogOpen && initialized) setInitialized(false);

  const addRow = () => {
    const next = rows.length > 0 ? Math.max(...rows.map(r => r.sequence_order)) + 1 : 1;
    setRows(prev => [...prev, { sequence_order: next, audit_type: 'surveillance', offset_months: 12, label: '' }]);
  };

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sequence_order: idx + 1 })));

  const updateRow = (i: number, field: keyof SequenceRow, value: string | number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleSave = async () => {
    try {
      await upsert.mutateAsync(rows.map((r, i) => ({
        client_certification_id: clientCertificationId,
        sequence_order: i + 1,
        audit_type: r.audit_type,
        offset_months: r.offset_months,
        label: r.label || null,
      })));
      toast.success('Sequenz gespeichert');
      setDialogOpen(false);
    } catch { toast.error('Fehler beim Speichern'); }
  };

  const handleApply = async () => {
    if (!validFrom) {
      toast.error('Kein Startdatum (Gültig ab) gesetzt — Audits können nicht berechnet werden');
      return;
    }
    const seqsToApply = hasClientSeqs ? clientSeqs : globalSeqs;
    if (seqsToApply.length === 0) {
      toast.error('Keine Sequenz konfiguriert');
      return;
    }

    setApplying(true);
    try {
      const { data: existingAudits } = await supabase
        .from('audits')
        .select('sequence_order')
        .eq('client_certification_id', clientCertificationId)
        .not('sequence_order', 'is', null);

      const existingOrders = new Set((existingAudits ?? []).map(a => a.sequence_order));
      const base = new Date(validFrom);
      let created = 0;

      for (const seq of seqsToApply) {
        if (existingOrders.has(seq.sequence_order)) continue;
        const scheduled = new Date(base);
        scheduled.setMonth(scheduled.getMonth() + seq.offset_months);

        await supabase.from('audits').insert({
          client_id: clientId,
          client_certification_id: clientCertificationId,
          type: seq.audit_type,
          status: 'scheduled',
          scheduled_date: scheduled.toISOString().split('T')[0],
          sequence_order: seq.sequence_order,
        });
        created++;
      }

      queryClient.invalidateQueries({ queryKey: ['audits'] });
      queryClient.invalidateQueries({ queryKey: ['certification-audits'] });

      if (created === 0) {
        toast.info('Alle Audits dieser Sequenz sind bereits vorhanden');
      } else {
        toast.success(`${created} Audit${created !== 1 ? 's' : ''} angelegt`);
      }
    } catch {
      toast.error('Fehler beim Anlegen der Audits');
    } finally {
      setApplying(false);
    }
  };

  const displaySeqs = hasClientSeqs ? clientSeqs : globalSeqs;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListOrdered className="h-4 w-4" />
              Audit-Sequenz
              {hasClientSeqs && (
                <Badge variant="secondary" className="text-xs ml-1">Individuell</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialogOpen(true)} title="Bearbeiten">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {clientLoading ? (
            <p className="text-xs text-muted-foreground">Lädt…</p>
          ) : displaySeqs.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground mb-2">Keine Sequenz konfiguriert</p>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Sequenz anlegen
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {displaySeqs.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-10 shrink-0">+{s.offset_months}M</span>
                  <span className="flex-1 truncate">{AUDIT_TYPE_LABELS[s.audit_type] ?? s.audit_type}{s.label ? ` · ${s.label}` : ''}</span>
                </div>
              ))}
              <Button
                size="sm"
                className="w-full mt-3 gap-2"
                onClick={handleApply}
                disabled={applying}
              >
                {applying
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus className="h-3.5 w-3.5" />}
                Sequenz anwenden
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Audit-Sequenz konfigurieren
            </DialogTitle>
            <DialogDescription>
              Legt fest welche Audits für diesen Kunden automatisch angelegt werden.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Audit-Typ</TableHead>
                    <TableHead className="w-40">Monate ab Start</TableHead>
                    <TableHead>Bezeichnung (optional)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                      <TableCell>
                        <Select value={row.audit_type} onValueChange={val => updateRow(i, 'audit_type', val as AuditType)}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SEQUENCE_AUDIT_TYPES.map(t => (
                              <SelectItem key={t} value={t}>{AUDIT_TYPE_LABELS[t] ?? t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} value={row.offset_months} onChange={e => updateRow(i, 'offset_months', Number(e.target.value))} className="w-24" />
                      </TableCell>
                      <TableCell>
                        <Input value={row.label} onChange={e => updateRow(i, 'label', e.target.value)} placeholder="z.B. 1. Überwachung" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeRow(i)} className="text-destructive hover:text-destructive">
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Noch keine Schritte — Vorlage wird verwendet.</p>
            )}
            <Button variant="outline" size="sm" onClick={addRow} className="gap-2">
              <Plus className="h-4 w-4" /> Schritt hinzufügen
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktiv', color: 'bg-success' },
  { value: 'pending', label: 'Ausstehend', color: 'bg-amber-500' },
  { value: 'expired', label: 'Abgelaufen', color: 'bg-destructive' },
  { value: 'suspended', label: 'Ausgesetzt', color: 'bg-warning' },
];

const CertificationDetailSkeleton = () => (
  <>
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </>
);

const CertificationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: certification, isLoading } = useClientCertification(id);
  const { data: client } = useClient(certification?.client_id || '');
  const { data: documents = [], isLoading: documentsLoading } = useCertificationDocuments(id);
  const { data: auditors = [] } = useAuditors();
  const { data: certificationBodies = [] } = useCertificationBodies();

  const updateCertification = useUpdateClientCertification();
  const deleteCertification = useDeleteClientCertification();
  const uploadDocument = useUploadCertificationDocument();
  const deleteDocument = useDeleteCertificationDocument();

  const [isEditing, setIsEditing] = useState(false);
  const [certificateNumber, setCertificateNumber] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [scope, setScope] = useState('');
  const [auditorId, setAuditorId] = useState<string | null>(null);
  const [certificationBodyId, setCertificationBodyId] = useState<string | null>(null);

  // Initialize form when certification loads
  useEffect(() => {
    if (certification) {
      setCertificateNumber(certification.certificate_number || '');
      setValidFrom(certification.valid_from || '');
      setValidUntil(certification.valid_until || '');
      setStatus(certification.status || 'active');
      setNotes(certification.notes || '');
      setScope(certification.scope || '');
      setAuditorId(certification.auditor_id || null);
      setCertificationBodyId(certification.certification_body_id || null);
    }
  }, [certification]);

  const handleSave = useCallback(async () => {
    if (!id) return;

    try {
      await updateCertification.mutateAsync({
        id,
        certificate_number: certificateNumber || null,
        valid_from: validFrom || null,
        valid_until: validUntil || null,
        status,
        notes: notes || null,
        scope: scope || null,
        auditor_id: auditorId || null,
        certification_body_id: certificationBodyId || null,
      });

      toast.success('Zertifikat erfolgreich aktualisiert');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating certification:', error);
      toast.error('Fehler beim Aktualisieren des Zertifikats');
    }
  }, [id, certificateNumber, validFrom, validUntil, status, notes, scope, auditorId, certificationBodyId, updateCertification]);

  const handleCancel = useCallback(() => {
    if (certification) {
      setCertificateNumber(certification.certificate_number || '');
      setValidFrom(certification.valid_from || '');
      setValidUntil(certification.valid_until || '');
      setStatus(certification.status || 'active');
      setNotes(certification.notes || '');
      setScope(certification.scope || '');
      setAuditorId(certification.auditor_id || null);
      setCertificationBodyId(certification.certification_body_id || null);
    }
    setIsEditing(false);
  }, [certification]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      await uploadDocument.mutateAsync({
        clientCertificationId: id,
        file,
      });
      toast.success('Dokument erfolgreich hochgeladen');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Fehler beim Hochladen des Dokuments');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const url = await getDocumentUrl(filePath);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Fehler beim Herunterladen');
    }
  };

  const handleDeleteDocument = async (docId: string, filePath: string) => {
    if (!id) return;

    try {
      await deleteDocument.mutateAsync({
        id: docId,
        filePath,
        clientCertificationId: id,
      });
      toast.success('Dokument gelöscht');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Fehler beim Löschen des Dokuments');
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === statusValue);
    if (!statusOption) return null;

    const colorMap: Record<string, string> = {
      active: 'bg-success/10 text-success border-success/20',
      valid: 'bg-success/10 text-success border-success/20',
      suspended: 'bg-warning/10 text-warning border-warning/20',
      expired: 'bg-destructive/10 text-destructive border-destructive/20',
      pending: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
    };

    return (
      <Badge
        variant="outline"
        className={`gap-1 ${colorMap[statusValue] || ''}`}
      >
        {statusValue === 'active' || statusValue === 'valid' ? <CheckCircle className="h-3 w-3" /> :
          statusValue === 'expired' ? <AlertCircle className="h-3 w-3" /> :
            <Clock className="h-3 w-3" />}
        {statusOption.label}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <CertificationDetailSkeleton />;
  }

  if (!certification) {
    return (
      <>
        <div className="p-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Zertifizierung nicht gefunden</p>
            <Button onClick={() => navigate('/clients')} className="mt-4">
              Zurück zu Kunden
            </Button>
          </div>
        </div>
      </>
    );
  }

  const certName = certification.certifications?.name || 'Zertifizierung';

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => navigate(-1)}
              title="Zurück"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center bg-primary/[0.08] rounded-xl shrink-0">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.01em] text-foreground sm:text-[30px]">{certName}</h1>
                {getStatusBadge(certification.status || 'active')}
              </div>
              {client && (
                <div
                  className="flex items-center gap-2 text-muted-foreground mt-1 text-xs sm:text-sm cursor-pointer hover:text-primary transition-colors"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <Building2 className="h-4 w-4" />
                  <span>{client.name}</span>
                  {client.client_number && (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>KD-Nr. {client.client_number}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-auto shrink-0">
            {!isEditing ? (
              <Button size="sm" className="sm:size-default gap-2" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Bearbeiten</span>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="sm:size-default gap-2" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Abbrechen</span>
                </Button>
                <Button size="sm" className="sm:size-default gap-2" onClick={handleSave} disabled={updateCertification.isPending}>
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">{updateCertification.isPending ? 'Speichert...' : 'Speichern'}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Certificate Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Zertifizierungsdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="cert-number">Zertifikatsnummer</Label>
                      <Input
                        id="cert-number"
                        value={certificateNumber}
                        onChange={(e) => setCertificateNumber(e.target.value)}
                        placeholder="z.B. CERT-2024-001"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="valid-from">Gültig ab</Label>
                        <Input
                          id="valid-from"
                          type="date"
                          value={validFrom}
                          onChange={(e) => setValidFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="valid-until">Gültig bis</Label>
                        <Input
                          id="valid-until"
                          type="date"
                          value={validUntil}
                          onChange={(e) => setValidUntil(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Status auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="auditor">Auditor</Label>
                      <Select value={auditorId || 'none'} onValueChange={(v) => setAuditorId(v === 'none' ? null : v)}>
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
                    <div className="space-y-2">
                      <Label htmlFor="cert-body">Zertifizierer</Label>
                      <Select value={certificationBodyId || 'none'} onValueChange={(v) => setCertificationBodyId(v === 'none' ? null : v)}>
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
                    <div className="space-y-2">
                      <Label htmlFor="scope">Scope</Label>
                      <Textarea
                        id="scope"
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="Beschreibung des Zertifizierungsumfangs..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notizen</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Zusätzliche Informationen zum Zertifikat..."
                        rows={4}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Hash className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Zertifikatsnummer</p>
                        <p className="font-medium">
                          {certification.certificate_number || 'Nicht vergeben'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Gültig ab</p>
                          <p className="font-medium">
                            {certification.valid_from
                              ? format(new Date(certification.valid_from), 'dd.MM.yyyy', { locale: de })
                              : 'Nicht festgelegt'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Gültig bis</p>
                          <p className="font-medium">
                            {certification.valid_until
                              ? format(new Date(certification.valid_until), 'dd.MM.yyyy', { locale: de })
                              : 'Nicht festgelegt'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Auditor display */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <User className="h-5 w-5 text-warning" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Auditor</p>
                        {(() => {
                          const currentAuditor = auditors.find(a => a.id === certification.auditor_id);
                          return currentAuditor ? (
                            <div className="flex items-center gap-2">
                              <AuditorPopover
                                auditor={{
                                  id: currentAuditor.id,
                                  name: currentAuditor.name,
                                  email: currentAuditor.email,
                                  phone: currentAuditor.phone,
                                }}
                              />
                            </div>
                          ) : (
                            <p className="font-medium text-muted-foreground">Nicht zugewiesen</p>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Zertifizierer display */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Zertifizierer</p>
                        <p className="font-medium">
                          {certification.certification_bodies?.name || 'Nicht zugewiesen'}
                        </p>
                      </div>
                    </div>
                    {certification.scope && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-1">Scope</p>
                        <p className="whitespace-pre-wrap">{certification.scope}</p>
                      </div>
                    )}
                    {certification.notes && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-1">Notizen</p>
                        <p className="whitespace-pre-wrap">{certification.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audits Card */}
            {id && client && certification?.certification_id && (
              <CertificationAuditsList
                clientCertificationId={id}
                clientId={client.id}
                certificationId={certification.certification_id}
                certificationName={certName}
              />
            )}

            {/* Documents Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dokumente
                </CardTitle>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  />
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadDocument.isPending}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadDocument.isPending ? 'Lädt hoch...' : 'Hochladen'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Keine Dokumente hochgeladen</p>
                    <p className="text-sm">Laden Sie PDF, Word, Excel oder Bilder hoch</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'dd.MM.yyyy', { locale: de })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(doc.file_path, doc.file_name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{doc.file_name}" wird dauerhaft gelöscht.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Informationen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Standard:</span>
                  <span className="font-medium">{certName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Erstellt:</span>
                  <span className="font-medium">
                    {format(new Date(certification.created_at), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Aktualisiert:</span>
                  <span className="font-medium">
                    {format(new Date(certification.updated_at), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Audit-Sequenz Konfiguration */}
            {id && certification?.certification_id && client && (
              <ClientSequenceCard
                clientCertificationId={id}
                certificationId={certification.certification_id}
                clientId={client.id}
                validFrom={certification.valid_from ?? null}
              />
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Aktionen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <Building2 className="h-4 w-4" />
                    Zum Kunden
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate('/audits')}
                >
                  <Calendar className="h-4 w-4" />
                  Audits anzeigen
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Zertifizierung löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zertifizierung löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Die Zertifizierung "{certName}" für {client?.name || 'diesen Kunden'} wird dauerhaft gelöscht.
                        Alle verknüpften Dokumente und Audits bleiben erhalten, verlieren aber die Verknüpfung.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            await deleteCertification.mutateAsync(id!);
                            toast.success('Zertifizierung erfolgreich gelöscht');
                            navigate(client ? `/clients/${client.id}` : '/clients');
                          } catch (error) {
                            console.error('Error deleting certification:', error);
                            toast.error('Fehler beim Löschen des Zertifikats');
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteCertification.isPending ? 'Löscht...' : 'Löschen'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default CertificationDetail;
