import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Pencil, Trash2, X, Check, Globe, User, Mail, Phone, MapPin, FileText, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCertificationBodies, useCreateCertificationBody, useUpdateCertificationBody, useDeleteCertificationBody, useClientsByCertificationBody, CertificationBody } from '@/hooks/useCertificationBodies';
import { Tables } from '@/integrations/supabase/types';

interface ClientByCertBody {
  id: string;
  client_id: string;
  clients: Tables<'clients'> | null;
}
import { toast } from 'sonner';
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
import { PageHeader } from '@/components/PageHeader';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const LinkedClients = ({ certificationBodyId }: { certificationBodyId: string }) => {
  const navigate = useNavigate();
  const { data: linkedClients = [] } = useClientsByCertificationBody(certificationBodyId);

  if (linkedClients.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3 w-3" />
        Kunden:
      </span>
      {(linkedClients as ClientByCertBody[]).map((item) => (
        <Badge
          key={item.id}
          variant="secondary"
          className="text-xs cursor-pointer hover:bg-primary/20 transition-colors"
          onClick={() => navigate(`/clients/${item.client_id}`)}
        >
          {item.clients?.name}
        </Badge>
      ))}
    </div>
  );
};

const CertificationBodies = () => {
  const { data: bodies = [], isLoading } = useCertificationBodies();
  const createBody = useCreateCertificationBody();
  const updateBody = useUpdateCertificationBody();
  const deleteBody = useDeleteCertificationBody();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    website: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      short_name: '',
      website: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    });
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    resetForm();
  };

  const handleEdit = (body: CertificationBody, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(body.id);
    setIsAdding(false);
    setFormData({
      name: body.name,
      short_name: body.short_name || '',
      website: body.website || '',
      contact_person: body.contact_person || '',
      email: body.email || '',
      phone: body.phone || '',
      address: body.address || '',
      notes: body.notes || '',
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    try {
      if (isAdding) {
        await createBody.mutateAsync(formData);
        toast.success('Zertifizierer erstellt');
      } else if (editingId) {
        await updateBody.mutateAsync({ id: editingId, ...formData });
        toast.success('Zertifizierer aktualisiert');
      }
      handleCancel();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBody.mutateAsync(deleteId);
      toast.success('Zertifizierer gelöscht');
      setDeleteId(null);
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const renderFormFields = (autoFocusName = false) => (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <Building2 className="h-3 w-3" /> Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="z.B. TÜV SÜD"
          className="h-8 text-sm"
          autoFocus={autoFocusName}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Kurzname</label>
        <Input
          value={formData.short_name}
          onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
          placeholder="z.B. TÜV"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <User className="h-3 w-3" /> Ansprechpartner
        </label>
        <Input
          value={formData.contact_person}
          onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
          placeholder="Max Mustermann"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <Mail className="h-3 w-3" /> E-Mail
        </label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="kontakt@beispiel.de"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <Phone className="h-3 w-3" /> Telefon
        </label>
        <Input
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          placeholder="+49 123 456789"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <Globe className="h-3 w-3" /> Website
        </label>
        <Input
          value={formData.website}
          onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
          placeholder="https://www.beispiel.de"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Adresse
        </label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Musterstraße 1, 12345 Musterstadt"
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1 md:col-span-2">
        <label className="text-xs font-medium flex items-center gap-1.5">
          <FileText className="h-3 w-3" /> Notizen
        </label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Weitere Informationen..."
          rows={2}
          className="text-sm"
        />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <>
        <div className="p-8 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        <PageHeader
          title="Zertifizierer"
          description="Verwalten Sie Ihre Zertifizierungspartner"
          actions={
            !isAdding && !editingId ? (
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                Hinzufügen
              </Button>
            ) : undefined
          }
        />

        {/* Add Form */}
        {isAdding && (
          <Card className="border-primary/50">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base">Neuer Zertifizierer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {renderFormFields(true)}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={createBody.isPending}>
                  <Check className="h-3 w-3 mr-1" />
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="h-3 w-3 mr-1" />
                  Abbrechen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        <div className="space-y-2">
          {bodies.map((body) => (
            <Card key={body.id} className={editingId === body.id ? 'border-primary/50' : ''}>
              {editingId === body.id ? (
                <CardContent className="pt-4 pb-4 space-y-3">
                  {renderFormFields(true)}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSave} disabled={updateBody.isPending}>
                      <Check className="h-3 w-3 mr-1" />
                      Speichern
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      <X className="h-3 w-3 mr-1" />
                      Abbrechen
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <Collapsible open={expandedId === body.id} onOpenChange={() => setExpandedId(expandedId === body.id ? null : body.id)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left hover:text-primary transition-colors">
                        {expandedId === body.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-medium">{body.name}</span>
                        {body.short_name && (
                          <span className="text-xs text-muted-foreground">({body.short_name})</span>
                        )}
                        {/* Compact inline info */}
                        {body.contact_person && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">• {body.contact_person}</span>
                        )}
                        {body.email && (
                          <span className="text-xs text-muted-foreground hidden md:inline">• {body.email}</span>
                        )}
                      </CollapsibleTrigger>

                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleEdit(body, e)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteId(body.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-sm">
                          {body.contact_person && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              <span>{body.contact_person}</span>
                            </div>
                          )}
                          {body.email && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <a href={`mailto:${body.email}`} className="hover:text-primary hover:underline">
                                {body.email}
                              </a>
                            </div>
                          )}
                          {body.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <a href={`tel:${body.phone}`} className="hover:text-primary">
                                {body.phone}
                              </a>
                            </div>
                          )}
                          {body.website && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Globe className="h-3.5 w-3.5" />
                              <a href={body.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline truncate">
                                {body.website}
                              </a>
                            </div>
                          )}
                          {body.address && (
                            <div className="flex items-center gap-2 text-muted-foreground md:col-span-2">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{body.address}</span>
                            </div>
                          )}
                        </div>

                        {body.notes && (
                          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            {body.notes}
                          </p>
                        )}

                        <LinkedClients certificationBodyId={body.id} />
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              )}
            </Card>
          ))}

          {bodies.length === 0 && !isAdding && (
            <Card>
              <CardContent className="py-8 text-center">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Keine Zertifizierer vorhanden</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleAdd}>
                  <Plus className="h-3 w-3 mr-1" />
                  Erste hinzufügen
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zertifizierer löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Diese Aktion kann nicht rückgängig gemacht werden. Die Zuordnungen zu Kunden werden ebenfalls entfernt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default CertificationBodies;
