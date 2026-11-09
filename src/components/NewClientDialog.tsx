import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useCreateClient, useParentClients, CertificationStandard } from '@/hooks/useClients';
import { useConsultants } from '@/hooks/useConsultants';
import { getCountryPrefix } from '@/lib/clientNumberUtils';

import { useCertifications } from '@/hooks/useCertifications';
import { useCreateClientCertification } from '@/hooks/useClientCertifications';
import { useAuditors } from '@/hooks/useAuditors';
import { Constants } from '@/integrations/supabase/types';
import { COUNTRIES } from '@/lib/constants';

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Track certification selection with optional auditor
interface CertificationSelection {
  certificationId: string;
  auditorId: string | null;
}

export const NewClientDialog = ({ open, onOpenChange }: NewClientDialogProps) => {
  const navigate = useNavigate();
  const [isCompanyGroup, setIsCompanyGroup] = useState(false);
  const [name, setName] = useState('');
  const [clientNumber, setClientNumber] = useState('0'); // Pre-filled with country prefix
  const [consultantId, setConsultantId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [customCountry, setCustomCountry] = useState(''); // For "Andere" option
  const [parentClientId, setParentClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [selectedCertifications, setSelectedCertifications] = useState<CertificationSelection[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [auditMode, setAuditMode] = useState<'on-site' | 'remote' | 'hybrid'>('on-site');


  const createClient = useCreateClient();
  const createClientCert = useCreateClientCertification();
  const { data: parentClients = [] } = useParentClients();
  const { data: certifications = [] } = useCertifications();
  const { data: auditors = [] } = useAuditors();
  const { data: consultants = [] } = useConsultants();

  const sortedParentClients = useMemo(() =>
    [...parentClients].sort((a, b) => a.name.localeCompare(b.name)),
    [parentClients]
  );

  const toggleCertification = (certId: string) => {
    setSelectedCertifications(prev => {
      const exists = prev.find(c => c.certificationId === certId);
      if (exists) {
        return prev.filter(c => c.certificationId !== certId);
      }
      return [...prev, { certificationId: certId, auditorId: null }];
    });
  };

  const updateCertificationAuditor = (certId: string, auditorId: string | null) => {
    setSelectedCertifications(prev =>
      prev.map(c =>
        c.certificationId === certId
          ? { ...c, auditorId }
          : c
      )
    );
  };

  const isCertificationSelected = (certId: string) => {
    return selectedCertifications.some(c => c.certificationId === certId);
  };

  const getSelectedAuditor = (certId: string) => {
    return selectedCertifications.find(c => c.certificationId === certId)?.auditorId || null;
  };


  // Update client number prefix when country changes
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    // Update the prefix in client number, keeping any existing sequence
    const prefix = getCountryPrefix(newCountry);
    const currentSequence = clientNumber.length > 1 ? clientNumber.slice(1) : '';
    setClientNumber(prefix + currentSequence);
  };

  const resetForm = () => {
    setIsCompanyGroup(false);
    setName('');
    setClientNumber('0'); // Reset to Deutschland prefix
    setConsultantId('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCountry('Deutschland');
    setCustomCountry('');
    setParentClientId('');
    setNotes('');
    setSelectedCertifications([]);
    setIsActive(true);
    setAuditMode('on-site');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Different validation for company groups vs clients
    if (isCompanyGroup) {
      if (!name) {
        toast.error('Bitte geben Sie einen Namen für die Unternehmensgruppe ein');
        return;
      }
      // Validate custom country for company groups if "Andere" is selected
      if (country === 'Andere' && !customCountry.trim()) {
        toast.error('Bitte geben Sie das Land ein');
        return;
      }
    } else {
      // Only name and consultant are mandatory for clients now
      if (!name) {
        toast.error('Bitte geben Sie einen Firmennamen ein');
        return;
      }
      if (!consultantId) {
        toast.error('Bitte geben Sie einen Berater an');
        return;
      }
      // Validate client number for regular clients
      if (!clientNumber || clientNumber.length < 2) {
        toast.error('Bitte geben Sie eine gültige Kundennummer ein');
        return;
      }
      // Validate custom country if "Andere" is selected
      if (country === 'Andere' && !customCountry.trim()) {
        toast.error('Bitte geben Sie das Land ein');
        return;
      }
    }

    try {
      // Determine effective country (use customCountry if "Andere" is selected)
      const effectiveCountry = country === 'Andere' && customCountry.trim()
        ? customCountry.trim()
        : country;

      const selectedConsultant = consultants.find(c => c.id === consultantId);
      const client = await createClient.mutateAsync({
        name,
        client_number: isCompanyGroup ? null : clientNumber, // Only clients get numbers
        consultant: selectedConsultant?.name || null,
        consultant_id: consultantId || null,
        contact_person: contactPerson || '-', // Optional, default placeholder
        email: email || null, // Optional, allow null
        phone: phone || null,
        address: address || null,
        country: effectiveCountry,
        parent_client_id: isCompanyGroup ? null : (parentClientId || null), // Company groups have no parent
        notes: notes || null,
        is_active: isActive,
        audit_mode: auditMode,
      });


      // Add client certifications (new system) with auditor if assigned - only for actual clients
      if (!isCompanyGroup) {
        for (const certSelection of selectedCertifications) {
          await createClientCert.mutateAsync({
            client_id: client.id,
            certification_id: certSelection.certificationId,
            auditor_id: certSelection.auditorId,
          });
        }
      }

      toast.success(isCompanyGroup ? 'Unternehmensgruppe erfolgreich erstellt' : 'Kunde erfolgreich erstellt');
      onOpenChange(false);
      resetForm();
      // Set highlight for auto-expand in clients list
      sessionStorage.setItem('highlight-client-id', client.id);
      // Navigate to the newly created client
      navigate(`/clients/${client.id}`);
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Fehler beim Erstellen des Kunden');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCompanyGroup ? 'Neue Unternehmensgruppe' : 'Neuer Kunde'}</DialogTitle>
          <DialogDescription>
            {isCompanyGroup
              ? 'Erstellen Sie eine neue Unternehmensgruppe als Dachgesellschaft'
              : 'Erstellen Sie einen neuen Kundeneintrag'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Toggle: Company Group or Client */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 p-4 border rounded-lg bg-muted/30">
            <Label className="text-sm font-medium w-full sm:w-auto">Was möchten Sie anlegen?</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!isCompanyGroup ? "default" : "outline"}
                size="sm"
                onClick={() => setIsCompanyGroup(false)}
              >
                Kunde
              </Button>
              <Button
                type="button"
                variant={isCompanyGroup ? "default" : "outline"}
                size="sm"
                onClick={() => setIsCompanyGroup(true)}
              >
                Unternehmensgruppe
              </Button>
            </div>

            {/* Active/Inactive Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="is-active" className="text-sm font-medium cursor-pointer">Status</Label>
                <p className="text-xs text-muted-foreground">
                  {isActive ? 'Kunde ist aktiv' : 'Kunde ist inaktiv'}
                </p>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {/* Parent Company Selection - only for clients */}
          {!isCompanyGroup && (
            <div className="space-y-2">
              <Label htmlFor="parent">Unternehmensgruppe (optional)</Label>
              <Select value={parentClientId || "none"} onValueChange={(val) => setParentClientId(val === "none" ? "" : val)}>
                <SelectTrigger id="parent">
                  <SelectValue placeholder="Keine Gruppe (eigenständig)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Gruppe (eigenständig)</SelectItem>
                  {sortedParentClients.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Wählen Sie eine Unternehmensgruppe, wenn dieser Kunde zu einem Konzern gehört
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Company Name */}
            <div className={`space-y-2 ${isCompanyGroup ? 'md:col-span-3' : 'md:col-span-2'}`}>
              <Label htmlFor="name">{isCompanyGroup ? 'Gruppenname' : 'Firmenname'} <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isCompanyGroup ? 'z.B. REUSS Gruppe' : 'z.B. REUSS Energie GmbH'}
              />
            </div>

            {/* Client Number - only for actual clients, not company groups */}
            {!isCompanyGroup && (
              <div className="space-y-2">
                <Label htmlFor="clientNumber">Kundennummer <span className="text-destructive">*</span></Label>
                <Input
                  id="clientNumber"
                  value={clientNumber}
                  onChange={(e) => setClientNumber(e.target.value)}
                  placeholder="z.B. 0001"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Erste Ziffer = Land ({getCountryPrefix(country)} = {country === 'Andere' && customCountry ? customCountry : country})
                </p>
              </div>
            )}
          </div>

          {/* Country - full width for company groups, half for clients */}
          {isCompanyGroup ? (
            <div className="space-y-4">
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

              {/* Custom country input when "Andere" is selected */}
              {country === 'Andere' && (
                <div className="space-y-2">
                  <Label htmlFor="customCountryGroup">Land eingeben <span className="text-destructive">*</span></Label>
                  <Input
                    id="customCountryGroup"
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    placeholder="z.B. Dänemark, Schweden..."
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country">Land <span className="text-destructive">*</span></Label>
                  <Select value={country} onValueChange={handleCountryChange}>
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

                {/* Consultant - MANDATORY for clients */}
                <div className="space-y-2">
                  <Label htmlFor="consultant">Berater <span className="text-destructive">*</span></Label>
                  <Select value={consultantId} onValueChange={setConsultantId}>
                    <SelectTrigger id="consultant">
                      <SelectValue placeholder="Berater auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.filter(c => c.is_active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom country input when "Andere" is selected */}
              {country === 'Andere' && (
                <div className="space-y-2">
                  <Label htmlFor="customCountry">Land eingeben <span className="text-destructive">*</span></Label>
                  <Input
                    id="customCountry"
                    value={customCountry}
                    onChange={(e) => setCustomCountry(e.target.value)}
                    placeholder="z.B. Dänemark, Schweden..."
                  />
                </div>
              )}
            </div>
          )}

          {/* Contact Person - optional for clients */}
          {!isCompanyGroup && (
            <div className="space-y-2">
              <Label htmlFor="contact-person">Ansprechpartner</Label>
              <Input
                id="contact-person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="z.B. Hans Müller (optional, später ergänzbar)"
              />
              <p className="text-xs text-muted-foreground">
                Kontaktdaten werden später bei "Zum Unternehmen" ergänzt
              </p>
            </div>
          )}

          {/* Email - optional for clients */}
          {!isCompanyGroup && (
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
          )}

          {/* Phone - optional for clients */}
          {!isCompanyGroup && (
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 123 456789 (optional)"
              />
            </div>
          )}

          {/* Address - only for clients */}
          {!isCompanyGroup && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Straße, PLZ Ort"
                />
              </div>

              {/* Audit Mode */}
              <div className="space-y-2">
                <Label htmlFor="audit-mode">Audit-Modus</Label>
                <Select value={auditMode} onValueChange={(val: 'on-site' | 'remote' | 'hybrid') => setAuditMode(val)}>
                  <SelectTrigger id="audit-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on-site">Vor-Ort (Präsenz)</SelectItem>
                    <SelectItem value="remote">Remote (Online)</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Notes - for both clients and company groups */}
          <div className="space-y-2">
            <Label htmlFor="notes">Bemerkungen / Notizen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interne Notizen..."
              rows={3}
            />
          </div>

          {/* Certifications (New System) with Auditor Selection - only for clients */}
          {!isCompanyGroup && (
            <div className="space-y-2">
              <Label>Zertifizierungen</Label>
              <div className="space-y-3 p-4 border rounded-lg">
                {certifications.map((cert) => {
                  const isSelected = isCertificationSelected(cert.id);
                  const selectedAuditor = getSelectedAuditor(cert.id);

                  return (
                    <div key={cert.id} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`cert-${cert.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleCertification(cert.id)}
                        />
                        <label
                          htmlFor={`cert-${cert.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {cert.name}
                        </label>
                      </div>
                      {/* Auditor selection appears when certification is selected */}
                      {isSelected && (
                        <div className="ml-6 flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Auditor:</Label>
                          <Select
                            value={selectedAuditor || "none"}
                            onValueChange={(val) => updateCertificationAuditor(cert.id, val === "none" ? null : val)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Kein Auditor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Kein Auditor</SelectItem>
                              {auditors.map((auditor) => (
                                <SelectItem key={auditor.id} value={auditor.id}>
                                  {auditor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? 'Erstelle...' : (isCompanyGroup ? 'Gruppe erstellen' : 'Kunde erstellen')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
