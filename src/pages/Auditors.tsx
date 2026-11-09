import { useState, useMemo } from 'react';
import { useAuditors, useCreateAuditor, useUpdateAuditor, useDeleteAuditor, AuditorWithCertificationBody } from '@/hooks/useAuditors';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Search, User, Building2, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { formatAuditorName, sortAuditorsByLastName } from '@/lib/auditorUtils';

const Auditors = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState<AuditorWithCertificationBody | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [certBodyId, setCertBodyId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const { data: auditors = [], isLoading } = useAuditors();
  const { data: certBodies = [] } = useCertificationBodies();
  const createAuditor = useCreateAuditor();
  const updateAuditor = useUpdateAuditor();
  const deleteAuditor = useDeleteAuditor();

  // Sort auditors by last name and filter by search
  const sortedAndFilteredAuditors = useMemo(() => {
    const sorted = sortAuditorsByLastName(auditors);
    return sorted.filter(auditor =>
      auditor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auditor.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auditor.certification_bodies?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [auditors, searchQuery]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCertBodyId('');
    setNotes('');
    setEditingAuditor(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (auditor: AuditorWithCertificationBody) => {
    setEditingAuditor(auditor);
    setName(auditor.name);
    setEmail(auditor.email || '');
    setPhone(auditor.phone || '');
    setCertBodyId(auditor.certification_body_id || '');
    setNotes(auditor.notes || '');
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    try {
      if (editingAuditor) {
        await updateAuditor.mutateAsync({
          id: editingAuditor.id,
          name,
          email: email || null,
          phone: phone || null,
          certification_body_id: certBodyId || null,
          notes: notes || null,
        });
        toast.success('Auditor erfolgreich aktualisiert');
      } else {
        await createAuditor.mutateAsync({
          name,
          email: email || null,
          phone: phone || null,
          certification_body_id: certBodyId || null,
          notes: notes || null,
        });
        toast.success('Auditor erfolgreich erstellt');
      }
      setShowDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error saving auditor:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAuditor.mutateAsync(id);
      toast.success('Auditor erfolgreich gelöscht');
    } catch (error) {
      console.error('Error deleting auditor:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        <PageHeader
          title="Auditoren"
          description={`${auditors.length} Einträge im System`}
          actions={
            <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Neuer Auditor
            </Button>
          }
        />

        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Suchen nach Name, Zertifizierer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 sm:h-10"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : sortedAndFilteredAuditors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Keine Auditoren gefunden</p>
              <Button onClick={openCreateDialog} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Ersten Auditor anlegen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {/* Desktop View: Table */}
            <Card className="hidden lg:block overflow-hidden border-border/50 shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold">Name</TableHead>
                    <TableHead className="font-bold">Zertifizierer</TableHead>
                    <TableHead className="font-bold">Kontakt</TableHead>
                    <TableHead className="w-[100px] font-bold">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAndFilteredAuditors.map((auditor) => (
                    <TableRow key={auditor.id} className="group transition-colors hover:bg-primary/[0.01]">
                      <TableCell className="font-semibold text-foreground">{formatAuditorName(auditor.name)}</TableCell>
                      <TableCell>
                        {auditor.certification_bodies ? (
                          <Badge variant="outline" className="gap-1.5 bg-primary/[0.03] border-primary/20 text-primary px-2.5 py-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {auditor.certification_bodies.short_name || auditor.certification_bodies.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Nicht zugeordnet</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 text-sm">
                          {auditor.email && (
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                              <Mail className="h-3.5 w-3.5 text-primary/60" />
                              <a href={`mailto:${auditor.email}`} className="hover:text-primary transition-colors">
                                {auditor.email}
                              </a>
                            </div>
                          )}
                          {auditor.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                              <Phone className="h-3.5 w-3.5 text-primary/60" />
                              <a href={`tel:${auditor.phone}`} className="hover:text-primary transition-colors">
                                {auditor.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEditDialog(auditor)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border-border/40 shadow-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Auditor löschen?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                  Möchten Sie "{auditor.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(auditor.id)} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile/Tablet View: Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
              {sortedAndFilteredAuditors.map((auditor) => (
                <Card key={auditor.id} className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20 group">
                  <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0 shadow-inner">
                        {auditor.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <CardTitle className="text-base truncate">{formatAuditorName(auditor.name)}</CardTitle>
                        {auditor.certification_bodies && (
                          <div className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5 truncate">
                            <Building2 className="h-3 w-3" />
                            {auditor.certification_bodies.short_name || auditor.certification_bodies.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground rounded-lg"
                        onClick={() => openEditDialog(auditor)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-lg">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[90%] max-w-md rounded-2xl border-border/40 shadow-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Auditor löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Möchten Sie "{auditor.name}" wirklich löschen?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row gap-2">
                            <AlertDialogCancel className="mt-0 flex-1 rounded-xl">Nein</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(auditor.id)} className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 transition-colors">
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                      {auditor.email && (
                        <a 
                          href={`mailto:${auditor.email}`} 
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 text-sm text-muted-foreground hover:text-primary transition-all active:scale-[0.98]"
                        >
                          <Mail className="h-4 w-4 text-primary/60" />
                          <span className="truncate">{auditor.email}</span>
                        </a>
                      )}
                      {auditor.phone && (
                        <a 
                          href={`tel:${auditor.phone}`} 
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 text-sm text-muted-foreground hover:text-primary transition-all active:scale-[0.98]"
                        >
                          <Phone className="h-4 w-4 text-primary/60" />
                          <span>{auditor.phone}</span>
                        </a>
                      )}
                    </div>
                    {auditor.notes && (
                      <div className="p-2.5 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground italic">
                        {auditor.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAuditor ? 'Auditor bearbeiten' : 'Neuer Auditor'}
              </DialogTitle>
              <DialogDescription>
                {editingAuditor ? 'Bearbeiten Sie die Auditordaten' : 'Erstellen Sie einen neuen Auditor'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cert-body">Zertifizierer</Label>
                <Select
                  value={certBodyId}
                  onValueChange={(v) => setCertBodyId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id="cert-body">
                    <SelectValue placeholder="Zertifizierer auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Keine</SelectItem>
                    {certBodies.map((body) => (
                      <SelectItem key={body.id} value={body.id}>
                        {body.short_name || body.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="auditor@beispiel.de"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notizen</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Zusätzliche Informationen..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={createAuditor.isPending || updateAuditor.isPending}>
                  {createAuditor.isPending || updateAuditor.isPending ? 'Speichert...' : 'Speichern'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Auditors;
