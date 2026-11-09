import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, User, Phone, Mail, Star, StarOff } from 'lucide-react';
import { toast } from 'sonner';
import { 
  useContacts, 
  useCreateContact, 
  useUpdateContact, 
  useDeleteContact,
  Contact,
  ContactInsert,
  ContactUpdate
} from '@/hooks/useContacts';

interface ContactManagementProps {
  clientId: string;
  isEditing?: boolean;
}

interface ContactFormData {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
  is_primary: boolean;
}

const emptyFormData: ContactFormData = {
  name: '',
  role: '',
  email: '',
  phone: '',
  notes: '',
  is_primary: false,
};

export const ContactManagement = ({ clientId, isEditing = false }: ContactManagementProps) => {
  const { data: contacts = [], isLoading } = useContacts(clientId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyFormData);

  const openCreateDialog = () => {
    setEditingContact(null);
    setFormData({
      ...emptyFormData,
      is_primary: contacts.length === 0, // First contact is primary by default
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      is_primary: contact.is_primary,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    try {
      if (editingContact) {
        // Update existing contact
        const updates: ContactUpdate & { id: string } = {
          id: editingContact.id,
          name: formData.name,
          role: formData.role || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
          is_primary: formData.is_primary,
        };

        // If setting as primary, first unset other primary contacts
        if (formData.is_primary && !editingContact.is_primary) {
          const currentPrimary = contacts.find(c => c.is_primary && c.id !== editingContact.id);
          if (currentPrimary) {
            await updateContact.mutateAsync({
              id: currentPrimary.id,
              is_primary: false,
            });
          }
        }

        await updateContact.mutateAsync(updates);
        toast.success('Kontakt aktualisiert');
      } else {
        // Create new contact
        const newContact: ContactInsert = {
          client_id: clientId,
          name: formData.name,
          role: formData.role || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
          is_primary: formData.is_primary,
        };

        // If setting as primary, first unset other primary contacts
        if (formData.is_primary) {
          const currentPrimary = contacts.find(c => c.is_primary);
          if (currentPrimary) {
            await updateContact.mutateAsync({
              id: currentPrimary.id,
              is_primary: false,
            });
          }
        }

        await createContact.mutateAsync(newContact);
        toast.success('Kontakt erstellt');
      }

      setIsDialogOpen(false);
      setFormData(emptyFormData);
      setEditingContact(null);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Fehler beim Speichern des Kontakts');
    }
  };

  const handleDelete = async () => {
    if (!deleteContactId) return;

    try {
      await deleteContact.mutateAsync(deleteContactId);
      toast.success('Kontakt gelöscht');
      setDeleteContactId(null);
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Fehler beim Löschen des Kontakts');
    }
  };

  const handleSetPrimary = async (contact: Contact) => {
    if (contact.is_primary) return;

    try {
      // Unset current primary
      const currentPrimary = contacts.find(c => c.is_primary);
      if (currentPrimary) {
        await updateContact.mutateAsync({
          id: currentPrimary.id,
          is_primary: false,
        });
      }

      // Set new primary
      await updateContact.mutateAsync({
        id: contact.id,
        is_primary: true,
      });

      toast.success('Hauptkontakt geändert');
    } catch (error) {
      console.error('Error setting primary contact:', error);
      toast.error('Fehler beim Ändern des Hauptkontakts');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Ansprechpartner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Ansprechpartner
            {contacts.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {contacts.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={openCreateDialog} className="gap-1">
            <Plus className="h-4 w-4" />
            Hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Keine Ansprechpartner vorhanden</p>
              <Button 
                variant="link" 
                onClick={openCreateDialog}
                className="mt-2"
              >
                Ersten Ansprechpartner hinzufügen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{contact.name}</span>
                      {contact.is_primary && (
                        <Badge variant="default" className="text-xs shrink-0">
                          <Star className="h-3 w-3 mr-1" />
                          Hauptkontakt
                        </Badge>
                      )}
                      {contact.role && (
                        <span className="text-sm text-muted-foreground truncate">
                          ({contact.role})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {contact.email && (
                        <a 
                          href={`mailto:${contact.email}`} 
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{contact.email}</span>
                        </a>
                      )}
                      {contact.phone && (
                        <a 
                          href={`tel:${contact.phone}`} 
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!contact.is_primary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSetPrimary(contact)}
                        title="Als Hauptkontakt setzen"
                      >
                        <StarOff className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteContactId(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Kontakt bearbeiten' : 'Neuer Ansprechpartner'}
            </DialogTitle>
            <DialogDescription>
              {editingContact 
                ? 'Bearbeiten Sie die Kontaktdaten.' 
                : 'Fügen Sie einen neuen Ansprechpartner hinzu.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="contact-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-role">Rolle / Position</Label>
              <Input
                id="contact-role"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                placeholder="z.B. Geschäftsführer, QM-Beauftragter"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-email">E-Mail</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@firma.de"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Telefon</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-notes">Notizen</Label>
              <Textarea
                id="contact-notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optionale Notizen..."
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-primary" className="font-medium cursor-pointer">
                  Hauptkontakt
                </Label>
                <p className="text-xs text-muted-foreground">
                  Wird in der Kundenliste angezeigt
                </p>
              </div>
              <Switch
                id="is-primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createContact.isPending || updateContact.isPending}
            >
              {createContact.isPending || updateContact.isPending 
                ? 'Speichert...' 
                : editingContact ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diesen Ansprechpartner wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContact.isPending ? 'Löscht...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};