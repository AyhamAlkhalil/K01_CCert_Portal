import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCertifications, DbCertification } from '@/hooks/useCertifications';
import {
  useCertificationAuditSequences,
  useUpsertAuditSequences,
  AuditSequence,
} from '@/hooks/useCertificationAuditSequences';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Award, Loader2, ListOrdered, GripVertical, X } from 'lucide-react';
import { AUDIT_TYPE_LABELS } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { Database } from '@/integrations/supabase/types';

type AuditType = Database['public']['Enums']['audit_type'];

type CertificationFormData = {
  name: string;
  description: string;
};

type SequenceRow = {
  sequence_order: number;
  audit_type: AuditType;
  offset_months: number;
  label: string;
};

const SEQUENCE_AUDIT_TYPES: AuditType[] = [
  'initial',
  'surveillance',
  'recertification',
  'six-month',
];

// Sub-component: Sequenz-Editor Dialog
function SequenceEditorDialog({
  open,
  onOpenChange,
  certification,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certification: DbCertification;
}) {
  const { data: savedSequences = [], isLoading } = useCertificationAuditSequences(certification.id);
  const upsert = useUpsertAuditSequences(certification.id);

  const [rows, setRows] = useState<SequenceRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync from DB when dialog opens
  if (open && !initialized && !isLoading) {
    const loaded: SequenceRow[] = savedSequences.map((s: AuditSequence) => ({
      sequence_order: s.sequence_order,
      audit_type: s.audit_type,
      offset_months: s.offset_months,
      label: s.label ?? '',
    }));
    setRows(loaded.length > 0 ? loaded : []);
    setInitialized(true);
  }
  if (!open && initialized) {
    setInitialized(false);
  }

  const addRow = () => {
    const nextOrder = rows.length > 0 ? Math.max(...rows.map(r => r.sequence_order)) + 1 : 1;
    setRows(prev => [
      ...prev,
      { sequence_order: nextOrder, audit_type: 'surveillance', offset_months: 12, label: '' },
    ]);
  };

  const removeRow = (index: number) => {
    setRows(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((r, i) => ({ ...r, sequence_order: i + 1 }));
    });
  };

  const updateRow = (index: number, field: keyof SequenceRow, value: string | number) => {
    setRows(prev =>
      prev.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      )
    );
  };

  const handleSave = async () => {
    const inserts = rows.map((r, i) => ({
      certification_id: certification.id,
      sequence_order: i + 1,
      audit_type: r.audit_type,
      offset_months: r.offset_months,
      label: r.label || null,
    }));

    try {
      await upsert.mutateAsync(inserts);
      toast.success('Sequenz gespeichert');
      onOpenChange(false);
    } catch {
      toast.error('Fehler beim Speichern der Sequenz');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Audit-Sequenz: {certification.name}
          </DialogTitle>
          <DialogDescription>
            Definieren Sie welche Audits automatisch angelegt werden, wenn ein Kunde diese Zertifizierung mit einem Startdatum erhält.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-muted-foreground text-sm">
                        <GripVertical className="h-4 w-4" />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.audit_type}
                          onValueChange={val => updateRow(index, 'audit_type', val as AuditType)}
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SEQUENCE_AUDIT_TYPES.map(type => (
                              <SelectItem key={type} value={type}>
                                {AUDIT_TYPE_LABELS[type] ?? type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={row.offset_months}
                          onChange={e => updateRow(index, 'offset_months', Number(e.target.value))}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.label}
                          onChange={e => updateRow(index, 'label', e.target.value)}
                          placeholder="z.B. 1. Überwachung"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Noch keine Schritte definiert. Fügen Sie den ersten Schritt hinzu.
              </p>
            )}

            <Button variant="outline" size="sm" onClick={addRow} className="gap-2">
              <Plus className="h-4 w-4" />
              Schritt hinzufügen
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CertificationsManagement() {
  const { data: certifications, isLoading } = useCertifications();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSequenceDialogOpen, setIsSequenceDialogOpen] = useState(false);
  const [editingCertification, setEditingCertification] = useState<DbCertification | null>(null);
  const [deletingCertification, setDeletingCertification] = useState<DbCertification | null>(null);
  const [sequenceCertification, setSequenceCertification] = useState<DbCertification | null>(null);
  const [formData, setFormData] = useState<CertificationFormData>({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingCertification(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (cert: DbCertification) => {
    setEditingCertification(cert);
    setFormData({ name: cert.name, description: cert.description || '' });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (cert: DbCertification) => {
    setDeletingCertification(cert);
    setIsDeleteDialogOpen(true);
  };

  const openSequenceDialog = (cert: DbCertification) => {
    setSequenceCertification(cert);
    setIsSequenceDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCertification) {
        const { error } = await supabase
          .from('certifications')
          .update({ name: formData.name.trim(), description: formData.description.trim() || null })
          .eq('id', editingCertification.id);
        if (error) throw error;
        toast.success('Zertifizierung aktualisiert');
      } else {
        const { error } = await supabase
          .from('certifications')
          .insert({ name: formData.name.trim(), description: formData.description.trim() || null });
        if (error) throw error;
        toast.success('Zertifizierung erstellt');
      }

      queryClient.invalidateQueries({ queryKey: ['certifications'] });
      setIsDialogOpen(false);
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCertification) return;
    try {
      const { error } = await supabase
        .from('certifications')
        .delete()
        .eq('id', deletingCertification.id);
      if (error) throw error;
      toast.success('Zertifizierung gelöscht');
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingCertification(null);
    }
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        <PageHeader
          title="Zertifizierungen"
          description="Verwalten Sie die verfügbaren Zertifizierungen"
          actions={
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Neue Zertifizierung
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
          </div>
        ) : certifications && certifications.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certifications.map((cert) => (
              <CertificationCard
                key={cert.id}
                cert={cert}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
                onSequence={openSequenceDialog}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Award className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-bold mb-1">Keine Zertifizierungen</h3>
              <p className="text-sm text-muted-foreground max-w-[250px] mb-6">
                Es wurden noch keine Zertifizierungen im Portal angelegt.
              </p>
              <Button onClick={openCreateDialog} variant="outline" className="rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Erste Zertifizierung anlegen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCertification ? 'Zertifizierung bearbeiten' : 'Neue Zertifizierung'}
            </DialogTitle>
            <DialogDescription>
              {editingCertification
                ? 'Ändern Sie die Details der Zertifizierung'
                : 'Erstellen Sie eine neue Zertifizierung'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. ISO 9001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionale Beschreibung der Zertifizierung"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCertification ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zertifizierung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Zertifizierung "{deletingCertification?.name}" wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sequence Editor */}
      {sequenceCertification && (
        <SequenceEditorDialog
          open={isSequenceDialogOpen}
          onOpenChange={(open) => {
            setIsSequenceDialogOpen(open);
            if (!open) setSequenceCertification(null);
          }}
          certification={sequenceCertification}
        />
      )}
    </>
  );
}

function CertificationCard({
  cert,
  onEdit,
  onDelete,
  onSequence,
}: {
  cert: DbCertification;
  onEdit: (cert: DbCertification) => void;
  onDelete: (cert: DbCertification) => void;
  onSequence: (cert: DbCertification) => void;
}) {
  const { data: sequences = [] } = useCertificationAuditSequences(cert.id);

  return (
    <Card className="group border-border/50 shadow-sm hover:shadow-md transition-all hover:border-primary/20 bg-card/40 backdrop-blur-sm overflow-hidden">
      <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-start justify-between">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary mb-2 shadow-inner">
          <Award className="h-5 w-5" />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Audit-Sequenz bearbeiten"
            onClick={() => onSequence(cert)}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            onClick={() => onEdit(cert)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => onDelete(cert)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <h4 className="font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
          {cert.name}
        </h4>
        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {cert.description || <span className="italic opacity-50">Keine Beschreibung</span>}
        </p>
        {sequences.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {sequences.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-xs">
                +{s.offset_months}M: {AUDIT_TYPE_LABELS[s.audit_type] ?? s.audit_type}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
