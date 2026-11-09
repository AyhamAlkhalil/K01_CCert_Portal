import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useClient, useUpdateClient, useDeleteClient, useParentClients } from '@/hooks/useClients';
import { ContactManagement } from '@/components/ContactManagement';
import { useClientCertifications, useCreateClientCertification } from '@/hooks/useClientCertifications';
import { useCertificationBodies } from '@/hooks/useCertificationBodies';
import { useClientAuditTasks } from '@/hooks/useAuditTasks';
import { ClientAuditHistory } from '@/components/ClientAuditHistory';
import { useCertifications } from '@/hooks/useCertifications';
import { useClientLock } from '@/hooks/useClientLock';
import { useConsultants } from '@/hooks/useConsultants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowLeft,
  Pencil,
  Save,
  X,
  Trash2,
  Calendar,
  Globe,
  Hash,
  UserCheck,
  Users,
  ChevronRight,
  Award,
  Plus,
  AlertTriangle,
  Lock,
  Monitor,
  Wifi,
  CheckCircle2,
  Clock,
  AlertCircle
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

import { COUNTRIES } from '@/lib/constants';

const ClientDetailSkeleton = () => (
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

const AUDIT_MODE_LABELS: Record<string, { label: string; icon: typeof Monitor }> = {
  'on-site': { label: 'Vor-Ort', icon: Building2 },
  'remote': { label: 'Remote', icon: Wifi },
  'hybrid': { label: 'Hybrid', icon: Monitor },
};

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading } = useClient(id || '');
  const { data: clientCertifications = [], isLoading: certificationsLoading } = useClientCertifications(id);
  const { data: clientTasks = [], isLoading: tasksLoading } = useClientAuditTasks(id || '');
  const { data: availableCertifications = [] } = useCertifications();
  const { data: certificationBodies = [] } = useCertificationBodies();
  const createClientCertification = useCreateClientCertification();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const { isLockedByOther, isLockedByMe, lockedByName, acquireLock, releaseLock } = useClientLock(id);
  const { data: consultants = [] } = useConsultants();
  const { data: parentClients = [] } = useParentClients();

  const [isEditing, setIsEditing] = useState(false);
  const [showAddCertDialog, setShowAddCertDialog] = useState(false);
  const [selectedCertificationId, setSelectedCertificationId] = useState<string>('');
  const [selectedCertBodyId, setSelectedCertBodyId] = useState<string>('');
  const [selectedValidFrom, setSelectedValidFrom] = useState<string>('');
  const [isAddingCert, setIsAddingCert] = useState(false);

  const [name, setName] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [consultantId, setConsultantId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [parentClientId, setParentClientId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [auditMode, setAuditMode] = useState('on-site');

  const openTasks = useMemo(() =>
    clientTasks.filter(t => t.status !== 'completed'),
    [clientTasks]
  );

  const findings = useMemo(() =>
    clientTasks.filter(t => t.category === 'finding' && t.status !== 'completed'),
    [clientTasks]
  );
  // Filter certifications that client doesn't already have
  const availableCertsToAdd = useMemo(() => {
    const existingCertIds = clientCertifications.map(cc => cc.certification_id);
    return availableCertifications.filter(cert => !existingCertIds.includes(cert.id));
  }, [availableCertifications, clientCertifications]);

  // Filter out current client from parent options (can't be its own parent)
  const sortedParentClients = useMemo(() =>
    [...parentClients].filter(p => p.id !== id).sort((a, b) => a.name.localeCompare(b.name)),
    [parentClients, id]
  );

  // Get parent client info
  const parentClient = useMemo(() =>
    parentClients.find(p => p.id === client?.parent_client_id),
    [parentClients, client?.parent_client_id]
  );

  // Initialize form when client loads
  useEffect(() => {
    if (client) {
      setName(client.name);
      setClientNumber(client.client_number || '');
      setConsultantId(client.consultant_id || '');
      setContactPerson(client.contact_person);
      setEmail(client.email);
      setPhone(client.phone || '');
      setAddress(client.address || '');
      setCountry(client.country || 'Deutschland');
      setParentClientId(client.parent_client_id || '');
      setIsActive(client.is_active !== false);
      setNotes(client.notes || '');
      setAuditMode(client.audit_mode || 'on-site');
    }
  }, [client]);

  const handleStartEditing = useCallback(async () => {
    if (isLockedByOther) return;
    const acquired = await acquireLock();
    if (acquired) {
      setIsEditing(true);
    } else {
      toast.error('Kunde wird gerade von jemand anderem bearbeitet');
    }
  }, [isLockedByOther, acquireLock]);

  const handleSave = useCallback(async () => {
    if (!id || !name) {
      toast.error('Name ist ein Pflichtfeld');
      return;
    }

    if (!clientNumber) {
      toast.error('Kundennummer ist ein Pflichtfeld');
      return;
    }

    if (!consultantId) {
      toast.error('Berater ist ein Pflichtfeld');
      return;
    }

    try {
      const selectedConsultant = consultants.find(c => c.id === consultantId);
      await updateClient.mutateAsync({
        id,
        name,
        client_number: clientNumber || null,
        consultant: selectedConsultant?.name || null,
        consultant_id: consultantId || null,
        contact_person: contactPerson,
        email,
        phone: phone || null,
        address: address || null,
        country,
        parent_client_id: parentClientId || null,
        is_active: isActive,
        notes: notes || null,
        audit_mode: auditMode,
      });

      toast.success('Kunde erfolgreich aktualisiert');
      setIsEditing(false);
      await releaseLock();
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Fehler beim Aktualisieren des Kunden');
    }
  }, [id, name, clientNumber, consultantId, consultants, contactPerson, email, phone, address, country, parentClientId, isActive, notes, auditMode, updateClient, releaseLock]);

  const handleCancel = useCallback(() => {
    if (client) {
      setName(client.name);
      setClientNumber(client.client_number || '');
      setConsultantId(client.consultant_id || '');
      setContactPerson(client.contact_person);
      setEmail(client.email);
      setPhone(client.phone || '');
      setAddress(client.address || '');
      setCountry(client.country || 'Deutschland');
      setParentClientId(client.parent_client_id || '');
      setIsActive(client.is_active !== false);
      setNotes(client.notes || '');
      setAuditMode(client.audit_mode || 'on-site');
    }
    setIsEditing(false);
    releaseLock();
  }, [client, releaseLock]);

  const handleDelete = useCallback(async () => {
    if (!id) return;

    try {
      await deleteClient.mutateAsync(id);
      toast.success('Kunde erfolgreich gelöscht');
      navigate('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Fehler beim Löschen des Kunden');
    }
  }, [id, deleteClient, navigate]);

  const handleAddCertification = useCallback(async () => {
    if (!id || !selectedCertificationId) {
      toast.error('Bitte wählen Sie eine Zertifizierung aus');
      return;
    }
    if (!selectedCertBodyId) {
      toast.error('Bitte wählen Sie einen Zertifizierer aus');
      return;
    }

    setIsAddingCert(true);
    try {
      await createClientCertification.mutateAsync({
        client_id: id,
        certification_id: selectedCertificationId,
        certification_body_id: selectedCertBodyId,
        valid_from: selectedValidFrom || null,
      });
      toast.success('Zertifizierung erfolgreich hinzugefügt');
      setShowAddCertDialog(false);
      setSelectedCertificationId('');
      setSelectedCertBodyId('');
      setSelectedValidFrom('');
    } catch (error) {
      console.error('Error adding certification:', error);
      toast.error('Fehler beim Hinzufügen der Zertifizierung');
    } finally {
      setIsAddingCert(false);
    }
  }, [id, selectedCertificationId, selectedCertBodyId, createClientCertification]);

  if (isLoading) {
    return <ClientDetailSkeleton />;
  }

  if (!client) {
    return (
      <>
        <div className="p-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Kunde nicht gefunden</p>
            <Button onClick={() => navigate('/clients')} className="mt-4">
              Zurück zu Kunden
            </Button>
          </div>
        </div>
      </>
    );
  }

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
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center bg-primary/10 rounded-xl shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {client.client_number && (
                  <Badge variant="outline" className="font-mono text-xs">
                    KD-Nr. {client.client_number}
                  </Badge>
                )}
                <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.01em] text-foreground sm:text-[30px] truncate">{client.name}</h1>
                {client.is_active === false && (
                  <Badge variant="destructive" className="text-xs sm:text-sm">
                    Inaktiv
                  </Badge>
                )}
                {client.audit_mode && client.audit_mode !== 'on-site' && (() => {
                  const mode = AUDIT_MODE_LABELS[client.audit_mode!] || AUDIT_MODE_LABELS['on-site'];
                  const ModeIcon = mode.icon;
                  return (
                    <Badge variant="outline" className="text-xs sm:text-sm gap-1">
                      <ModeIcon className="h-3 w-3" />
                      {mode.label}
                    </Badge>
                  );
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground mt-1 text-xs sm:text-sm">
                <Globe className="h-3.5 w-3.5" />
                <span>{client.country || 'Nicht zugeordnet'}</span>
                {(() => {
                  const consultantName = client.consultant_id
                    ? consultants.find(c => c.id === client.consultant_id)?.name
                    : client.consultant;
                  return consultantName ? (
                    <>
                      <span className="text-muted-foreground/50">•</span>
                      <span>Berater: {consultantName}</span>
                    </>
                  ) : null;
                })()}
                <span className="text-muted-foreground/50">•</span>
                <span>Angelegt am {format(new Date(client.created_at), 'dd.MM.yyyy', { locale: de })}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-auto shrink-0">
            {!isEditing ? (
              <Button
                size="sm"
                className="sm:size-default gap-2"
                onClick={handleStartEditing}
                disabled={isLockedByOther}
              >
                {isLockedByOther ? <Lock className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                <span className="hidden sm:inline">{isLockedByOther ? 'Gesperrt' : 'Bearbeiten'}</span>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="sm:size-default gap-2" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Abbrechen</span>
                </Button>
                <Button size="sm" className="sm:size-default gap-2" onClick={handleSave} disabled={updateClient.isPending}>
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">{updateClient.isPending ? 'Speichert...' : 'Speichern'}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Lock Banner */}
        {isLockedByOther && (
          <Alert className="border-warning/25 bg-warning/5">
            <Lock className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Wird gerade von <span className="font-semibold">{lockedByName}</span> bearbeitet. Bearbeitung ist temporär gesperrt.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Contact Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Kontaktdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    {/* Active Status Toggle */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                      <div className="space-y-0.5">
                        <Label htmlFor="is-active" className="font-medium">
                          Status
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Inaktive Kunden werden standardmäßig nicht angezeigt
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${isActive ? 'text-muted-foreground' : 'font-medium text-destructive'}`}>
                          Inaktiv
                        </span>
                        <Switch
                          id="is-active"
                          checked={isActive}
                          onCheckedChange={setIsActive}
                        />
                        <span className={`text-sm ${isActive ? 'font-medium text-success' : 'text-muted-foreground'}`}>
                          Aktiv
                        </span>
                      </div>
                    </div>

                    {/* Parent Company Selection */}
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                      <Label htmlFor="parent" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Unternehmensgruppe
                      </Label>
                      <Select
                        value={parentClientId}
                        onValueChange={(v) => setParentClientId(v === '__none__' ? '' : v)}
                      >
                        <SelectTrigger id="parent">
                          <SelectValue placeholder="Keine Gruppe (eigenständig)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Keine Gruppe (eigenständig)</SelectItem>
                          {sortedParentClients.map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Ordnen Sie diesen Kunden einer Unternehmensgruppe zu
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="name">Firmenname <span className="text-destructive">*</span></Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Firmenname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-number">KD-Nr. <span className="text-destructive">*</span></Label>
                        <Input
                          id="client-number"
                          value={clientNumber}
                          onChange={(e) => setClientNumber(e.target.value)}
                          placeholder="z.B. 0001"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country">Land <span className="text-destructive">*</span></Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger id="country">
                            <SelectValue placeholder="Land auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consultant">Berater <span className="text-destructive">*</span></Label>
                        <Select value={consultantId} onValueChange={setConsultantId}>
                          <SelectTrigger id="consultant">
                            <SelectValue placeholder="Berater auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {consultants.filter(c => c.is_active || c.id === consultantId).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="z.B. kontakt@firma.de"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Telefon"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Adresse</Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Adresse"
                      />
                    </div>
                    {/* Audit Mode */}
                    <div className="space-y-2">
                      <Label htmlFor="audit-mode">Audit-Modus</Label>
                      <Select value={auditMode} onValueChange={setAuditMode}>
                        <SelectTrigger id="audit-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on-site">Vor-Ort</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Bemerkungen / Notizen</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Interne Notizen zu diesem Kunden..."
                        rows={4}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Parent Company Display */}
                    {parentClient && (
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                        onClick={() => navigate(`/clients/${parentClient.id}`)}
                      >
                        <Users className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Unternehmensgruppe</p>
                          <p className="font-medium text-primary">{parentClient.name}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">E-Mail</p>
                        <a href={`mailto:${client.email}`} className="font-medium text-primary hover:underline">
                          {client.email}
                        </a>
                      </div>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Telefon</p>
                          <a href={`tel:${client.phone}`} className="font-medium text-primary hover:underline">
                            {client.phone}
                          </a>
                        </div>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Adresse</p>
                          <p className="font-medium">{client.address}</p>
                        </div>
                      </div>
                    )}
                    {client.notes && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground mb-1">Bemerkungen</p>
                        <p className="font-medium whitespace-pre-wrap">{client.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Certifications Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Zertifizierungen
                </CardTitle>
                <Dialog open={showAddCertDialog} onOpenChange={(open) => { setShowAddCertDialog(open); if (!open) { setSelectedCertificationId(''); setSelectedCertBodyId(''); setSelectedValidFrom(''); } }}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={availableCertsToAdd.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                      Hinzufügen
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Neue Zertifizierung hinzufügen</DialogTitle>
                      <DialogDescription>
                        Wählen Sie die Zertifizierung und den zuständigen Zertifizierer aus.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <div>
                        <Label htmlFor="certification">Zertifizierung <span className="text-destructive">*</span></Label>
                        <Select value={selectedCertificationId} onValueChange={setSelectedCertificationId}>
                          <SelectTrigger id="certification" className="mt-2">
                            <SelectValue placeholder="Zertifizierung auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCertsToAdd.map((cert) => (
                              <SelectItem key={cert.id} value={cert.id}>
                                {cert.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cert-body">Zertifizierer <span className="text-destructive">*</span></Label>
                        <Select value={selectedCertBodyId} onValueChange={setSelectedCertBodyId}>
                          <SelectTrigger id="cert-body" className="mt-2">
                            <SelectValue placeholder="Zertifizierer auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {certificationBodies.map((body) => (
                              <SelectItem key={body.id} value={body.id}>
                                {body.short_name || body.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="valid-from">
                          Gültig ab
                          <span className="ml-2 text-xs text-muted-foreground font-normal">(Audits werden automatisch angelegt)</span>
                        </Label>
                        <Input
                          id="valid-from"
                          type="date"
                          value={selectedValidFrom}
                          onChange={(e) => setSelectedValidFrom(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddCertDialog(false)}>
                        Abbrechen
                      </Button>
                      <Button onClick={handleAddCertification} disabled={!selectedCertificationId || !selectedCertBodyId || isAddingCert}>
                        {isAddingCert ? 'Wird hinzugefügt...' : 'Hinzufügen'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {certificationsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : clientCertifications.length > 0 ? (
                  <div className="space-y-2">
                    {clientCertifications.map((cc) => {
                      const statusColors: Record<string, string> = {
                        active: 'bg-success/[0.12] text-success border-success/30',
                        valid: 'bg-success/[0.12] text-success border-success/30',
                        suspended: 'bg-warning/[0.12] text-warning border-warning/30',
                        expired: 'bg-destructive/[0.12] text-destructive border-destructive/30',
                        pending: 'bg-amber-500/[0.15] text-amber-800 border-amber-500/40',
                        withdrawn: 'bg-muted text-muted-foreground border-border',
                      };
                      const statusLabel: Record<string, string> = {
                        active: 'Aktiv',
                        valid: 'Gültig',
                        suspended: 'Ausgesetzt',
                        expired: 'Abgelaufen',
                        pending: 'Ausstehend',
                        withdrawn: 'Zurückgezogen',
                      };
                      return (
                        <div
                          key={cc.id}
                          onClick={() => navigate(`/certifications/${cc.id}`)}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg cursor-pointer transition-colors group gap-1 ${cc.status === 'expired' ? 'bg-destructive/5 border border-destructive/20 hover:bg-destructive/10'
                            : cc.status === 'suspended' ? 'bg-warning/5 border border-warning/20 hover:bg-warning/10'
                              : 'bg-muted/50 hover:bg-primary/10'
                            }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            {(cc.status === 'expired' || cc.status === 'suspended') && (
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                            )}
                            <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                              {cc.certifications?.name || 'Unbekannt'}
                            </Badge>
                            {cc.status && (
                              <Badge variant="outline" className={`text-xs ${statusColors[cc.status] || ''}`}>
                                {statusLabel[cc.status] || cc.status}
                              </Badge>
                            )}
                            {cc.valid_until && (
                              <span className="text-xs text-muted-foreground">
                                bis {format(new Date(cc.valid_until), 'dd.MM.yyyy', { locale: de })}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 hidden sm:block" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Keine Zertifizierungen hinterlegt</p>
                )}
              </CardContent>
            </Card>

            {/* Open Tasks & Findings */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Offene Aufgaben & Abweichungen
                </CardTitle>
                <div className="flex gap-2">
                  {findings.length > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {findings.length} Abweichung{findings.length !== 1 ? 'en' : ''}
                    </Badge>
                  )}
                  {openTasks.length > 0 && (
                    <Badge variant="secondary">
                      {openTasks.length} Aufgabe{openTasks.length !== 1 ? 'n' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : openTasks.length > 0 ? (
                  <div className="space-y-3">
                    {openTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/audits/${task.audit_id}`)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                          task.category === 'finding' ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {task.category === 'finding' ? (
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              Audit: {task.audits?.type} am {task.audits?.scheduled_date ? format(new Date(task.audits.scheduled_date), 'dd.MM.yyyy') : '–'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.due_date && (
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              new Date(task.due_date) < new Date() ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                            )}>
                              {format(new Date(task.due_date), 'dd.MM.yyyy')}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p>Keine offenen Aufgaben für diesen Kunden</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit History Card */}
            <ClientAuditHistory clientId={id!} />

            {/* Contact Management Card */}
            <ContactManagement clientId={id!} isEditing={isEditing} />

          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Informationen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Land:</span>
                  <span className="font-medium">{client.country || 'Nicht zugeordnet'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Erstellt:</span>
                  <span className="font-medium">
                    {format(new Date(client.created_at), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Aktualisiert:</span>
                  <span className="font-medium">
                    {format(new Date(client.updated_at), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Gefahrenzone</CardTitle>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full gap-2">
                      <Trash2 className="h-4 w-4" />
                      Kunde löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Kunde wirklich löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Diese Aktion kann nicht rückgängig gemacht werden. Der Kunde und alle zugehörigen Audits werden dauerhaft gelöscht.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteClient.isPending ? 'Löscht...' : 'Endgültig löschen'}
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

export default ClientDetail;
