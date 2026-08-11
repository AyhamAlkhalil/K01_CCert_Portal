import { useState, useMemo, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NewClientDialog } from '@/components/NewClientDialog';
import { useCertificationsByClient, useCountryGroups } from '@/hooks/useClientGroups';

import { MoveClientDialog } from '@/components/MoveClientDialog';
import { useClients, useDeleteClient, useUpdateClient, DbClient } from '@/hooks/useClients';
import { supabase } from '@/integrations/supabase/client';
import { useAllClientCertifications } from '@/hooks/useClientCertifications';
import { useContactsByClientIds } from '@/hooks/useContacts';
import { useAuditorsForCertifications } from '@/hooks/useAuditorsForCertifications';
import { useAuditors } from '@/hooks/useAuditors';
import { useConsultants } from '@/hooks/useConsultants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { Skeleton } from '@/components/ui/skeleton';
import { ClientNumberBadge, GroupClientNumbers } from '@/components/ClientNumberBadge';

import { ContactPopover } from '@/components/ContactPopover';
import { AuditorPopover } from '@/components/AuditorPopover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Award,
  Building2,

  Eye,

  AlertTriangle,
  User,
  Globe,
  MoreHorizontal,
  ExternalLink,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Monitor,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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
import { toast } from 'sonner';
import { exportClientsToExcel } from '@/lib/clientExport';


const AUDIT_MODE_CONFIG = {
  remote: {
    label: 'Remote',
    Icon: Globe,
    modeBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    certBadge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  hybrid: {
    label: 'Hybrid',
    Icon: Monitor,
    modeBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    certBadge: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  'on-site': {
    label: 'Präsenz',
    Icon: Building2,
    modeBadge: 'bg-slate-50 text-slate-600 border-slate-200',
    certBadge: 'bg-slate-100 text-slate-700 border-slate-300',
  },
} as const;

const getAuditModeConfig = (mode: string | null) =>
  AUDIT_MODE_CONFIG[(mode as keyof typeof AUDIT_MODE_CONFIG) ?? 'on-site'] ?? AUDIT_MODE_CONFIG['on-site'];

const Clients = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('clients-search-query') || '');
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);

  const [moveDialogClient, setMoveDialogClient] = useState<DbClient | null>(null);
  const [deleteGroupClient, setDeleteGroupClient] = useState<{ client: DbClient; childCount: number } | null>(null);
  const [renameGroup, setRenameGroup] = useState<{ client: DbClient; newName: string } | null>(null);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('clients-expanded-countries');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('clients-expanded-groups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('clients-expanded-clients');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>(() =>
    (sessionStorage.getItem('clients-status-filter') as 'active' | 'inactive' | 'all') || 'active'
  );
  const [auditorFilter, setAuditorFilter] = useState<string>(() =>
    sessionStorage.getItem('clients-auditor-filter') || 'all'
  );
  const [consultantFilter, setConsultantFilter] = useState<string>(() =>
    sessionStorage.getItem('clients-consultant-filter') || 'all'
  );

  const { data: clients = [], isLoading, error } = useClients();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();
  const { data: allCertifications = [] } = useAllClientCertifications();
  const { data: allAuditors = [] } = useAuditors();
  const { data: allConsultants = [] } = useConsultants();

  // Get all client IDs for bulk contact fetch
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  const { data: contactsMap = {} } = useContactsByClientIds(clientIds);

  // Get auditors for all certifications
  const { data: auditorsByClientCertification = {} } = useAuditorsForCertifications();
  // Client certifications grouped by certificate_number
  const certificationsByClient = useCertificationsByClient(allCertifications);

  // Filter clients by active status, search, and auditor
  const filteredClients = useMemo(() => {
    // Stage 1: Basic Matching (Individual level)
    const directSearchMatches = new Set<string>();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      clients.forEach(c => {
        if (c.name.toLowerCase().includes(q) || c.contact_person?.toLowerCase().includes(q) || c.client_number?.toLowerCase().includes(q) || c.country?.toLowerCase().includes(q)) {
          directSearchMatches.add(c.id);
        }
      });
    } else {
      clients.forEach(c => directSearchMatches.add(c.id));
    }

    const statMatches = new Set<string>();
    clients.forEach(c => {
      if (statusFilter === 'all') statMatches.add(c.id);
      else if (statusFilter === 'active' && c.is_active !== false) statMatches.add(c.id);
      else if (statusFilter === 'inactive' && c.is_active === false && c.is_active !== null) statMatches.add(c.id);
    });

    const audMatches = new Set<string>();
    if (auditorFilter === 'all') {
      clients.forEach(c => audMatches.add(c.id));
    } else {
      const clientIdsWithAuditor = new Set<string>();
      if (auditorFilter === 'none') {
        Object.entries(certificationsByClient).forEach(([clientId, certRows]) => {
          if (certRows.some(row => !auditorsByClientCertification[row.primaryCertificationId])) clientIdsWithAuditor.add(clientId);
        });
      } else {
        Object.entries(certificationsByClient).forEach(([clientId, certRows]) => {
          if (certRows.some(row => auditorsByClientCertification[row.primaryCertificationId]?.auditorId === auditorFilter)) clientIdsWithAuditor.add(clientId);
        });
      }
      clients.forEach(c => { if (clientIdsWithAuditor.has(c.id)) audMatches.add(c.id); });
    }

    // Consultant filter — match own consultant or inherit from parent
    const directConsultantMatches = new Set<string>();
    if (consultantFilter === 'all') {
      clients.forEach(c => directConsultantMatches.add(c.id));
    } else if (consultantFilter === 'none') {
      clients.forEach(c => { if (!c.consultant_id && !c.consultant) directConsultantMatches.add(c.id); });
    } else {
      clients.forEach(c => { if (c.consultant_id === consultantFilter) directConsultantMatches.add(c.id); });
    }
    const consMatches = new Set<string>();
    clients.forEach(c => {
      if (directConsultantMatches.has(c.id) || (c.parent_client_id && directConsultantMatches.has(c.parent_client_id))) {
        consMatches.add(c.id);
      }
    });

    // Stage 2: Hierarchy Application
    // A client is kept if:
    // 1. It matches all active filters (Status, Auditor, and Search/ParentSearch)
    const survivors = new Set<string>();
    clients.forEach(c => {
      // Check for search match (including context)
      const matchesSearch = directSearchMatches.has(c.id) || (c.parent_client_id && directSearchMatches.has(c.parent_client_id));

      // Must match ALL filters to be a primary survivor
      if (matchesSearch && statMatches.has(c.id) && audMatches.has(c.id) && consMatches.has(c.id)) {
        survivors.add(c.id);
        // If it survives, its parent must also survive to provide the group header context
        if (c.parent_client_id) survivors.add(c.parent_client_id);
      }
    });

    // Special case: Group headers that match search directly and pass other filters should be shown
    // even if they have no matching children (empty folder support)
    clients.forEach(c => {
      if (!c.parent_client_id && !survivors.has(c.id)) {
        if (directSearchMatches.has(c.id) && statMatches.has(c.id) && audMatches.has(c.id) && consMatches.has(c.id)) {
          survivors.add(c.id);
        }
      }
    });

    return clients.filter(c => survivors.has(c.id));
  }, [searchQuery, clients, statusFilter, auditorFilter, consultantFilter, certificationsByClient, auditorsByClientCertification]);

  // Group clients by country → company groups
  const countryGroups = useCountryGroups(filteredClients, certificationsByClient);

  // Initialize expanded countries on first load
  useEffect(() => {
    if (expandedCountries.size === 0 && countryGroups.length > 0) {
      const allCountries = new Set(countryGroups.map(cg => cg.country));
      setExpandedCountries(allCountries);
      sessionStorage.setItem('clients-expanded-countries', JSON.stringify([...allCountries]));
    }
  }, [countryGroups.length]); // only re-run when number of countries changes

  // Auto-expand to highlight a specific client (e.g. after creation)
  useEffect(() => {
    const highlightId = sessionStorage.getItem('highlight-client-id');
    if (!highlightId || clients.length === 0 || countryGroups.length === 0) return;
    sessionStorage.removeItem('highlight-client-id');

    const targetClient = clients.find(c => c.id === highlightId);
    if (!targetClient) return;

    const country = targetClient.country || 'Unbekannt';
    setExpandedCountries(prev => {
      const next = new Set(prev);
      next.add(country);
      sessionStorage.setItem('clients-expanded-countries', JSON.stringify([...next]));
      return next;
    });

    // Find which group contains this client
    for (const cg of countryGroups) {
      for (const group of cg.companyGroups) {
        const isInGroup = group.headerClient.id === highlightId ||
          group.children.some(c => c.client.id === highlightId);
        if (isInGroup) {
          setExpandedGroups(prev => {
            const next = new Set(prev);
            next.add(group.id);
            sessionStorage.setItem('clients-expanded-groups', JSON.stringify([...next]));
            return next;
          });
          setExpandedClients(prev => {
            const next = new Set(prev);
            next.add(highlightId);
            sessionStorage.setItem('clients-expanded-clients', JSON.stringify([...next]));
            return next;
          });
          break;
        }
      }
    }
  }, [clients, countryGroups]);

  const toggleCountry = useCallback((country: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country);
      else next.add(country);
      sessionStorage.setItem('clients-expanded-countries', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      sessionStorage.setItem('clients-expanded-groups', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleClient = useCallback((id: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      sessionStorage.setItem('clients-expanded-clients', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const renderCertificationRows = (clientId: string, client: DbClient) => {
    const certRows = certificationsByClient[clientId] || [];

    // Check for legacy certifications that are not yet migrated
    const legacyCerts: string[] = [];
    const hasLegacyCerts = false;

    if (certRows.length === 0 && !hasLegacyCerts) {
      return (
        <div className="pl-16 py-2 text-sm text-muted-foreground italic">
          Keine Zertifizierungen
        </div>
      );
    }

    // Show legacy certifications with migration hint if no new ones exist
    if (hasLegacyCerts) {
      return (
        <div
          className="flex items-center justify-between gap-4 pl-16 pr-4 py-2 text-sm border-t border-border/30 hover:bg-muted/30 cursor-pointer"
          onClick={() => navigate(`/clients/${clientId}`)}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {legacyCerts.map((cert) => (
                <Badge key={cert} variant="outline" className="gap-1 border-warning text-warning">
                  <Award className="h-3 w-3" />
                  {cert}
                </Badge>
              ))}
            </div>
            <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded">
              Migration erforderlich
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Bitte Zertifikat öffnen</span>
          </div>
        </div>
      );
    }

    return certRows.map((row, idx) => {
      // Get auditor for the first certification in this row
      const auditorInfo = auditorsByClientCertification[row.primaryCertificationId];

      return (
        <div
          key={`${row.clientId}-${idx}`}
          className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 pl-12 sm:pl-16 pr-4 py-3 sm:py-2 text-sm border-t border-border/30 hover:bg-muted/30 cursor-pointer transition-colors",
            row.certifications.some(c => c.status === 'expired') && "bg-red-50/50 dark:bg-red-950/10",
            row.certifications.some(c => c.status === 'suspended') && "bg-orange-50/50 dark:bg-orange-950/10"
          )}
          onClick={() => navigate(`/certifications/${row.primaryCertificationId}`)}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {row.certifications.map((cert) => (
                <Badge key={cert.certificationId} variant="secondary" className="gap-1 text-[10px] sm:text-xs">
                  <Award className="h-3 w-3" />
                  {cert.certificationName}
                </Badge>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
              {row.certifications[0]?.certificateNumber && (
                <span className="truncate">
                  Nr. {row.certifications[0].certificateNumber}
                </span>
              )}
              {row.earliestValidUntil && (
                <span>
                  bis {format(new Date(row.earliestValidUntil), 'dd.MM.yyyy', { locale: de })}
                </span>
              )}
              <div className="flex gap-1.5">
                {Array.from(new Set(row.certifications.map(c => c.status).filter(Boolean))).map((status, i) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-green-100/80 text-green-800 border-green-200',
                    valid: 'bg-green-100/80 text-green-800 border-green-200',
                    suspended: 'bg-orange-100/80 text-orange-800 border-orange-200',
                    expired: 'bg-red-100/80 text-red-800 border-red-200',
                    pending: 'bg-yellow-100/80 text-yellow-800 border-yellow-200',
                    withdrawn: 'bg-gray-100/80 text-gray-800 border-gray-200',
                  };
                  const statusLabel: Record<string, string> = {
                    active: 'Aktiv', valid: 'Gültig', suspended: 'Ausgesetzt', expired: 'Abgelaufen', pending: 'Ausstehend', withdrawn: 'Zurückgezogen',
                  };
                  return (
                    <Badge key={i} variant="outline" className={`text-[9px] sm:text-[10px] font-medium ${statusColors[status!] || ''}`}>
                      {statusLabel[status!] || status}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Auditor */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {auditorInfo ? (
              <AuditorPopover
                auditor={{
                  id: auditorInfo.auditorId,
                  name: auditorInfo.auditorName,
                  email: auditorInfo.auditorEmail,
                  phone: auditorInfo.auditorPhone,
                }}
              />
            ) : (
              <div className="flex items-center gap-1.5 text-warning/80">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[10px] sm:text-xs font-medium">Kein Auditor</span>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const renderClientWithCerts = (client: DbClient, indent = false) => {
    const certs = certificationsByClient[client.id] || [];
    const legacyCerts: string[] = [];
    const hasCerts = certs.length > 0;
    const isExpanded = expandedClients.has(client.id);
    const contacts = contactsMap[client.id] || [];
    const clientIsActive = client.is_active !== false;

    return (
      <div key={client.id}>
        <div
          className={cn(
            'flex items-start sm:items-center justify-between px-3 sm:px-4 py-3 hover:bg-muted/50 cursor-pointer border-t border-border/50',
            indent ? 'pl-6 sm:pl-10 bg-muted/20' : '',
            !clientIsActive ? 'opacity-60' : '',
            isExpanded ? 'bg-primary/5 border-l-4 border-l-primary' : ''
          )}
          onClick={() => hasCerts ? toggleClient(client.id) : navigate(`/clients/${client.id}`)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {hasCerts ? (
                isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn('truncate', indent ? '' : 'font-medium')}>{client.name}</span>
              <ClientNumberBadge clientNumber={client.client_number} />
              {!isMobile && (
                <>
                  {!clientIsActive && (
                    <Badge variant="destructive" className="text-xs">Inaktiv</Badge>
                  )}
                  {hasCerts && (
                    legacyCerts.length > 0 && certs.length === 0 ? (
                      <Badge variant="outline" className="text-xs border-warning text-warning">
                        {legacyCerts.length} (Migration)
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {certs.length} Zertifikat{certs.length !== 1 ? 'e' : ''}
                      </Badge>
                    )
                  )}
                  {(() => {
                    const cfg = getAuditModeConfig(client.audit_mode);
                    return (
                      <Badge variant="outline" className={`text-xs gap-1 font-medium ${cfg.modeBadge}`}>
                        <cfg.Icon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                    );
                  })()}
                </>
              )}
            </div>
            {/* Mobile: show badges below name */}
            {isMobile && (
              <div className="flex items-center gap-2 mt-1 ml-6 flex-wrap">
                {!clientIsActive && (
                  <Badge variant="destructive" className="text-xs">Inaktiv</Badge>
                )}
                {hasCerts && (
                  legacyCerts.length > 0 && certs.length === 0 ? (
                    <Badge variant="outline" className="text-xs border-warning text-warning">
                      {legacyCerts.length} (Migr.)
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {certs.length} Zert.
                    </Badge>
                  )
                )}
                {(() => {
                  const cfg = getAuditModeConfig(client.audit_mode);
                  return (
                    <Badge variant="outline" className={`text-xs gap-1 ${cfg.modeBadge}`}>
                      <cfg.Icon className="h-3 w-3" /> {cfg.label}
                    </Badge>
                  );
                })()}
              </div>
            )}
          </div>
          {/* Desktop: contact + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!isMobile && (
              <ContactPopover
                legacyName={client.contact_person}
                legacyPhone={client.phone}
                legacyEmail={client.email}
                contacts={contacts}
                clientId={client.id}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 sm:h-8 sm:w-8"
                  title="Aktionen"
                  aria-label="Aktionen"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/clients/${client.id}`);
                }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Zum Unternehmen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  setMoveDialogClient(client);
                }}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Verschieben
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {isExpanded && (
          <div className="bg-muted/10">
            {renderCertificationRows(client.id, client)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Kunden</h1>
            <p className="text-muted-foreground text-sm">
              {countryGroups.reduce((sum, cg) => sum + cg.companyGroups.length, 0)} Unternehmensgruppen • {clients.filter(c => c.client_number !== null).length} Kunden
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" disabled={clients.length === 0} onClick={() => {
              exportClientsToExcel(clients);
              toast.success(`${clients.length} Kunden exportiert`);
            }}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline text-xs sm:text-sm">Excel-Export</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const allCountryIds = new Set(countryGroups.map(cg => cg.country));
              const allGroupIds = new Set(countryGroups.flatMap(cg => cg.companyGroups.map(g => g.id)));
              const allClientIds = new Set(countryGroups.flatMap(cg => cg.companyGroups.flatMap(g => g.children.map(c => c.client.id))));
              setExpandedCountries(allCountryIds);
              setExpandedGroups(allGroupIds);
              setExpandedClients(allClientIds);
              sessionStorage.setItem('clients-expanded-countries', JSON.stringify([...allCountryIds]));
              sessionStorage.setItem('clients-expanded-groups', JSON.stringify([...allGroupIds]));
              sessionStorage.setItem('clients-expanded-clients', JSON.stringify([...allClientIds]));
            }}>
              <span className="text-xs sm:text-sm">Alle aufklappen</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setExpandedCountries(new Set());
              setExpandedGroups(new Set());
              setExpandedClients(new Set());
              sessionStorage.setItem('clients-expanded-countries', JSON.stringify([]));
              sessionStorage.setItem('clients-expanded-groups', JSON.stringify([]));
              sessionStorage.setItem('clients-expanded-clients', JSON.stringify([]));
            }}>
              <span className="text-xs sm:text-sm">Alle zuklappen</span>
            </Button>
            <Button size="sm" className="sm:size-default" onClick={() => setShowNewClientDialog(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Neuer Kunde</span>
            </Button>
          </div>
        </div>

        <NewClientDialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog} />

        {moveDialogClient && (
          <MoveClientDialog
            open={!!moveDialogClient}
            onOpenChange={(open) => !open && setMoveDialogClient(null)}
            client={moveDialogClient}
          />
        )}

        {/* Search + View Toggle + Filters */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Suchen nach Name, Nummer, Stadt..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                sessionStorage.setItem('clients-search-query', e.target.value);
              }}
              className="pl-10 h-11 sm:h-10 bg-background/50 border-border/60 focus:bg-background transition-all"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-4">
            {/* Auditor Filter */}
            <Select
              value={auditorFilter}
              onValueChange={(val) => {
                setAuditorFilter(val);
                sessionStorage.setItem('clients-auditor-filter', val);
              }}
            >
              <SelectTrigger className="h-10 sm:h-9 bg-background/50">
                <div className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Auditor" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-xl z-50">
                <SelectItem value="all">Alle Auditoren</SelectItem>
                <SelectItem value="none">
                  <span className="flex items-center gap-1.5 text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Ohne Auditor
                  </span>
                </SelectItem>
                {allAuditors.map((auditor) => (
                  <SelectItem key={auditor.id} value={auditor.id}>
                    {auditor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(val) => {
                const filter = val as 'active' | 'inactive' | 'all';
                setStatusFilter(filter);
                sessionStorage.setItem('clients-status-filter', filter);
              }}
            >
              <SelectTrigger className="h-10 sm:h-9 bg-background/50">
                <div className="flex items-center gap-2 truncate">
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-xl z-50">
                <SelectItem value="all">Alle Stati</SelectItem>
                <SelectItem value="active">Nur aktive</SelectItem>
                <SelectItem value="inactive">Nur inaktive</SelectItem>
              </SelectContent>
            </Select>

            {/* Consultant Filter */}
            <Select
              value={consultantFilter}
              onValueChange={(val) => {
                setConsultantFilter(val);
                sessionStorage.setItem('clients-consultant-filter', val);
              }}
            >
              <SelectTrigger className="h-10 sm:h-9 bg-background/50">
                <div className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Berater" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-xl z-50">
                <SelectItem value="all">Alle Berater</SelectItem>
                <SelectItem value="none">
                  <span className="flex items-center gap-1.5 text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Ohne Berater
                  </span>
                </SelectItem>
                {allConsultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <p className="text-destructive text-center py-12">Fehler beim Laden</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filteredClients.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Keine Kunden gefunden</p>
        ) : (
          /* GROUPED BY COUNTRY VIEW */
          <div className="space-y-4">
            {countryGroups.map(countryGroup => {
              const isCountryExpanded = expandedCountries.has(countryGroup.country);
              const totalCompanies = countryGroup.companyGroups.length;

              return (
                <div key={countryGroup.country} className="border rounded-lg overflow-hidden">
                  {/* Country Header */}
                  <div
                    className="flex items-center justify-between px-3 sm:px-4 py-3.5 cursor-pointer hover:bg-muted/50 bg-primary/[0.04] transition-colors"
                    onClick={() => toggleCountry(countryGroup.country)}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
                        {isCountryExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      <Globe className="h-4 w-4 text-primary/70 shrink-0" />
                      <span className="font-bold text-base sm:text-lg tracking-tight uppercase">{countryGroup.country}</span>
                      <Badge variant="secondary" className="text-[10px] font-bold px-1.5 h-5 min-w-[20px] justify-center">
                        {totalCompanies}
                      </Badge>
                    </div>
                  </div>

                  {/* Country Content - Company Groups */}
                  {isCountryExpanded && (
                    <div className="divide-y">
                      {countryGroup.companyGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.id);
                        const totalCerts = group.children.reduce((sum, c) => sum + c.certifications.length, 0);
                        const isMultiClient = group.isGroupOnly;

                        const headerClient = group.headerClient;
                        const headerContacts = contactsMap[headerClient.id] || [];

                        return (
                          <div key={group.id}>
                            {/* Group Header */}
                            <div
                              className="flex items-start sm:items-center justify-between px-3 sm:px-4 py-4 cursor-pointer hover:bg-muted/50 bg-card border-l-2 border-transparent transition-all pl-6 sm:pl-8"
                              onClick={() => toggleGroup(group.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex items-center justify-center w-5 h-5 text-muted-foreground/60">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 font-semibold">
                                    {isMultiClient ? (
                                      <FolderTree className="h-4 w-4 text-primary/70 shrink-0" />
                                    ) : (
                                      <Building2 className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                    )}
                                    <span className="truncate">{group.name}</span>
                                  </div>
                                  
                                  {!isMobile && (
                                    <div className="flex items-center gap-2">
                                      {isMultiClient ? (
                                        <>
                                          <Badge variant="outline" className="text-xs font-normal">Gruppe</Badge>
                                          <GroupClientNumbers
                                            clientNumbers={group.children.map(c => c.client.client_number)}
                                          />
                                          {totalCerts > 0 && (
                                            <Badge variant="secondary" className="text-xs h-5">
                                              {totalCerts} Zertifikat{totalCerts !== 1 ? 'e' : ''}
                                            </Badge>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <ClientNumberBadge clientNumber={headerClient.client_number} />
                                          {totalCerts > 0 && (
                                            <Badge variant="secondary" className="text-xs h-5">
                                              {totalCerts} Zertifikat{totalCerts !== 1 ? 'e' : ''}
                                            </Badge>
                                          )}
                                          {(() => {
                                            const cfg = getAuditModeConfig(headerClient.audit_mode);
                                            return (
                                              <Badge variant="outline" className={`text-xs gap-1 font-medium ${cfg.modeBadge}`}>
                                                <cfg.Icon className="h-3 w-3" /> {cfg.label}
                                              </Badge>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {isMobile && (
                                  <div className="flex items-center gap-2 mt-2 ml-7 flex-wrap">
                                    {isMultiClient && (
                                      <Badge variant="outline" className="text-[10px] h-5 font-normal">Gruppe</Badge>
                                    )}
                                    {!isMultiClient && (
                                      <ClientNumberBadge clientNumber={headerClient.client_number} />
                                    )}
                                    {totalCerts > 0 && (
                                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium">
                                        {totalCerts} Zert.
                                      </Badge>
                                    )}
                                    {!isMultiClient && (() => {
                                      const cfg = getAuditModeConfig(headerClient.audit_mode);
                                      return (
                                        <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${cfg.modeBadge}`}>
                                          <cfg.Icon className="h-3 w-3" /> {cfg.label}
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* Actions on the right */}
                              <div className="flex items-center gap-2 shrink-0">
                                {!isMultiClient && !isMobile && (
                                  <ContactPopover
                                    legacyName={headerClient.contact_person}
                                    legacyPhone={headerClient.phone}
                                    legacyEmail={headerClient.email}
                                    contacts={headerContacts}
                                    clientId={headerClient.id}
                                  />
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-7 w-7 sm:h-8 sm:w-8"
                                      title="Aktionen"
                                      aria-label="Aktionen"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!isMultiClient && (
                                      <>
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/clients/${headerClient.id}`);
                                        }}>
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Zum Unternehmen
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          setMoveDialogClient(headerClient);
                                        }}>
                                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                                          Verschieben
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {isMultiClient && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRenameGroup({ client: headerClient, newName: headerClient.name });
                                          }}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Umbenennen
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteGroupClient({ client: headerClient, childCount: group.children.length });
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Gruppe löschen
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Expanded Content - Shows clients in group */}
                            {isExpanded && (
                              <div className="bg-muted/20">
                                {group.children.length === 0 ? (
                                  <div className="py-2 text-sm text-muted-foreground italic pl-8 sm:pl-14 border-t border-border/30">
                                    Noch keine Kunden in dieser Unternehmensgruppe.
                                  </div>
                                ) : (
                                  group.children.map((childWithCerts) => {
                                    const { client, certifications } = childWithCerts;
                                    const contacts = contactsMap[client.id] || [];
                                    const isClientExpanded = expandedClients.has(client.id);
                                    const clientIsActive = client.is_active !== false;

                                    return (
                                      <div key={client.id}>
                                        {/* Client Row */}
                                        {isMultiClient ? (
                                          <div
                                            className={cn(
                                              'flex items-start sm:items-center justify-between px-3 sm:px-4 py-2 pl-8 sm:pl-14 bg-muted/30 border-t border-border/50 cursor-pointer hover:bg-muted/50',
                                              !clientIsActive ? 'opacity-60' : ''
                                            )}
                                            onClick={() => certifications.length > 0 ? toggleClient(client.id) : navigate(`/clients/${client.id}`)}
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {certifications.length > 0 ? (
                                                  isClientExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
                                                ) : (
                                                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                                )}
                                                <span className="font-medium truncate">{client.name}</span>
                                                <ClientNumberBadge clientNumber={client.client_number} />
                                                {!isMobile && (
                                                  <>
                                                    {!clientIsActive && (
                                                      <Badge variant="destructive" className="text-xs">Inaktiv</Badge>
                                                    )}
                                                    {certifications.length > 0 && (
                                                      <Badge variant="secondary" className="text-xs">
                                                        {certifications.length} Zertifikat{certifications.length !== 1 ? 'e' : ''}
                                                      </Badge>
                                                    )}
                                                    {(() => {
                                                      const cfg = getAuditModeConfig(client.audit_mode);
                                                      return (
                                                        <Badge variant="outline" className={`text-xs gap-1 font-medium ${cfg.modeBadge}`}>
                                                          <cfg.Icon className="h-3 w-3" /> {cfg.label}
                                                        </Badge>
                                                      );
                                                    })()}
                                                  </>
                                                )}
                                              </div>
                                              {isMobile && (
                                                <div className="flex items-center gap-2 mt-1 ml-6 flex-wrap">
                                                  {!clientIsActive && (
                                                    <Badge variant="destructive" className="text-xs">Inaktiv</Badge>
                                                  )}
                                                  {certifications.length > 0 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                      {certifications.length} Zert.
                                                    </Badge>
                                                  )}
                                                  {(() => {
                                                    const cfg = getAuditModeConfig(client.audit_mode);
                                                    return (
                                                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.modeBadge}`}>
                                                        <cfg.Icon className="h-3 w-3" /> {cfg.label}
                                                      </Badge>
                                                    );
                                                  })()}
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {!isMobile && (
                                                <ContactPopover
                                                  legacyName={client.contact_person}
                                                  legacyPhone={client.phone}
                                                  legacyEmail={client.email}
                                                  contacts={contacts}
                                                  clientId={client.id}
                                                />
                                              )}
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                                    title="Aktionen"
                                                    aria-label="Aktionen"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/clients/${client.id}`);
                                                  }}>
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    Zum Unternehmen
                                                  </DropdownMenuItem>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMoveDialogClient(client);
                                                  }}>
                                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                                    Verschieben
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                        ) : null}

                                        {/* Certification Rows */}
                                        {(!isMultiClient || isClientExpanded) && (
                                          <>
                                            {certifications.length > 0 ? (
                                              certifications.map((row, idx) => {
                                                const auditorInfo = auditorsByClientCertification[row.primaryCertificationId];

                                                return (
                                                  <div
                                                    key={`${row.clientId}-${idx}`}
                                                    className={cn(
                                                      'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-3 sm:px-4 py-2 text-sm border-t border-border/30 hover:bg-muted/40 cursor-pointer',
                                                      isMultiClient ? 'pl-10 sm:pl-20' : 'pl-8 sm:pl-14'
                                                    )}
                                                    onClick={() => navigate(`/certifications/${row.primaryCertificationId}`)}
                                                  >
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      {row.certifications.map((cert) => (
                                                        <Badge key={cert.certificationId} variant="secondary" className="gap-1 text-xs">
                                                          <Award className="h-3 w-3" />
                                                          {cert.certificationName}
                                                        </Badge>
                                                      ))}
                                                      {row.certifications[0]?.certificateNumber && (
                                                        <span className="text-muted-foreground text-xs">
                                                          Nr. {row.certifications[0].certificateNumber}
                                                        </span>
                                                      )}
                                                      {row.earliestValidUntil && (
                                                        <span className="text-muted-foreground text-xs">
                                                          bis {new Date(row.earliestValidUntil).toLocaleDateString('de-DE')}
                                                        </span>
                                                      )}
                                                      {row.certifications.map(c => c.status).filter(Boolean).map((status, i) => {
                                                        const statusColors: Record<string, string> = {
                                                          active: 'bg-green-100 text-green-800 border-green-300',
                                                          valid: 'bg-green-100 text-green-800 border-green-300',
                                                          suspended: 'bg-orange-100 text-orange-800 border-orange-300',
                                                          expired: 'bg-red-100 text-red-800 border-red-300',
                                                          pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                                                          withdrawn: 'bg-gray-100 text-gray-800 border-gray-300',
                                                        };
                                                        const statusLabel: Record<string, string> = {
                                                          active: 'Aktiv', valid: 'Gültig', suspended: 'Ausgesetzt', expired: 'Abgelaufen', pending: 'Ausstehend', withdrawn: 'Zurückgezogen',
                                                        };
                                                        return (
                                                          <Badge key={i} variant="outline" className={`text-xs ${statusColors[status!] || ''}`}>
                                                            {statusLabel[status!] || status}
                                                          </Badge>
                                                        );
                                                      })}
                                                    </div>
                                                    <div className="shrink-0">
                                                      {auditorInfo ? (
                                                        <AuditorPopover
                                                          auditor={{
                                                            id: auditorInfo.auditorId,
                                                            name: auditorInfo.auditorName,
                                                            email: auditorInfo.auditorEmail,
                                                            phone: auditorInfo.auditorPhone,
                                                          }}
                                                        />
                                                      ) : (
                                                        <div className="flex items-center gap-1.5 text-warning">
                                                          <AlertTriangle className="h-3.5 w-3.5" />
                                                          <span className="text-xs font-medium">Kein Auditor</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            ) : (
                                              <div className={cn(
                                                'py-2 text-sm text-muted-foreground italic border-t border-border/30',
                                                isMultiClient ? 'pl-10 sm:pl-20' : 'pl-8 sm:pl-14'
                                              )}>
                                                Keine Zertifizierungen
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={!!deleteGroupClient} onOpenChange={(open) => !open && setDeleteGroupClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unternehmensgruppe löschen</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroupClient && deleteGroupClient.childCount > 0 ? (
                <>
                  Die Unternehmensgruppe <strong>„{deleteGroupClient.client.name}"</strong> enthält noch{' '}
                  <strong>{deleteGroupClient.childCount} Kunde{deleteGroupClient.childCount > 1 ? 'n' : ''}</strong>.
                  Beim Löschen werden alle Kunden zu eigenständigen Kunden ohne Gruppenzugehörigkeit.
                </>
              ) : (
                <>
                  Möchten Sie die leere Unternehmensgruppe <strong>„{deleteGroupClient?.client.name}"</strong> wirklich löschen?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteGroupClient) return;
                try {
                  // First, detach all children by setting their parent_client_id to null
                  if (deleteGroupClient.childCount > 0) {
                    const { error: updateError } = await supabase
                      .from('clients')
                      .update({ parent_client_id: null })
                      .eq('parent_client_id', deleteGroupClient.client.id);
                    if (updateError) throw updateError;
                  }
                  // Then delete the group itself
                  await deleteClient.mutateAsync(deleteGroupClient.client.id);
                  toast.success(`Unternehmensgruppe „${deleteGroupClient.client.name}" wurde gelöscht.`);
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Fehler beim Löschen der Unternehmensgruppe.';
                  toast.error(message);
                }
                setDeleteGroupClient(null);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Group Dialog */}
      <AlertDialog open={!!renameGroup} onOpenChange={(open) => !open && setRenameGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unternehmensgruppe umbenennen</AlertDialogTitle>
            <AlertDialogDescription>
              Geben Sie den neuen Namen für die Unternehmensgruppe ein.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={renameGroup?.newName || ''}
              onChange={(e) => setRenameGroup(prev => prev ? { ...prev, newName: e.target.value } : null)}
              placeholder="Neuer Name"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={!renameGroup?.newName.trim()}
              onClick={async () => {
                if (!renameGroup || !renameGroup.newName.trim()) return;
                try {
                  await updateClient.mutateAsync({ id: renameGroup.client.id, name: renameGroup.newName.trim() });
                  toast.success(`Unternehmensgruppe umbenannt zu „${renameGroup.newName.trim()}".`);
                } catch (err) {
                  console.error('Error renaming group:', err);
                  toast.error('Fehler beim Umbenennen der Unternehmensgruppe.');
                }
                setRenameGroup(null);
              }}
            >
              Speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Clients;
