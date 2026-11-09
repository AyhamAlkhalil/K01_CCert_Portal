import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, ShieldCheck, AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import { useAllClientCertifications } from '@/hooks/useClientCertifications';
import { Tables } from '@/integrations/supabase/types';
import { format, differenceInDays, isPast, isToday } from 'date-fns';

interface ClientCertificationWithClients extends Tables<'client_certifications'> {
  certifications: Tables<'certifications'> | null;
  clients: Pick<Tables<'clients'>, 'id' | 'name' | 'is_active'> | null;
}
import { de } from 'date-fns/locale';

interface ExpiringCertification {
  id: string;
  clientName: string;
  clientId: string;
  certificationName: string;
  validUntil: Date;
  daysUntilExpiry: number;
  status: 'expired' | 'critical' | 'warning' | 'ok';
}

const KanbanColumn = ({
  title,
  icon: Icon,
  items,
  accentClass,
  badgeVariant,
  emptyText,
  onItemClick,
}: {
  title: string;
  icon: React.ElementType;
  items: ExpiringCertification[];
  accentClass: string;
  badgeVariant: 'destructive' | 'outline' | 'secondary';
  emptyText: string;
  onItemClick: (id: string) => void;
}) => (
  <div className="flex flex-col min-w-0">
    <div className={`flex items-center gap-2 mb-3 mr-2 pb-2 border-b-2 ${accentClass}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] truncate">{title}</span>
      <Badge variant={badgeVariant} className="text-[11px] px-2 py-0 ml-auto shrink-0">
        {items.length}
      </Badge>
    </div>
    <ScrollArea className="h-[260px]">
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-1.5 pr-2">
          {items.map((cert) => (
            <div
              key={cert.id}
              onClick={() => onItemClick(cert.id)}
              className="group rounded-lg border border-border/70 bg-card p-3 cursor-pointer transition-all hover:shadow-md hover:border-foreground/20"
            >
              <p className="text-[13px] font-medium truncate leading-snug">{cert.clientName}</p>
              <p className="text-xs text-muted-foreground truncate">{cert.certificationName}</p>
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/50">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {format(cert.validUntil, 'dd.MM.yyyy')}
                </span>
                <span className="text-[11px] font-medium tabular-nums">
                  {cert.status === 'expired'
                    ? `${Math.abs(cert.daysUntilExpiry)} Tage überfällig`
                    : `in ${cert.daysUntilExpiry} Tagen`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  </div>
);

export const ExpiringCertificationsCard = () => {
  const navigate = useNavigate();
  const { data: rawCertifications = [], isLoading } = useAllClientCertifications();
  const certifications = rawCertifications as ClientCertificationWithClients[];

  const expiringCertifications = useMemo(() => {
    const result: ExpiringCertification[] = [];

    for (const cert of certifications) {
      // Nur aktive Kunden anzeigen
      if (cert.clients?.is_active === false) continue;
      if (!cert.valid_until) continue;

      const validUntil = new Date(cert.valid_until);
      const daysUntilExpiry = differenceInDays(validUntil, new Date());

      // Show certifications expiring within the next 90 days (approx. 3 months)
      // This makes the list more actionable as requested by the user.
      if (daysUntilExpiry > 90) continue;

      let status: ExpiringCertification['status'] = 'ok';
      if (isPast(validUntil) && !isToday(validUntil)) {
        status = 'expired';
      } else if (daysUntilExpiry <= 30) {
        status = 'critical';
      } else if (daysUntilExpiry <= 90) {
        status = 'warning';
      }

      result.push({
        id: cert.id,
        clientName: cert.clients?.name || 'Unbekannt',
        clientId: cert.client_id,
        certificationName: cert.certifications?.name || 'Unbekannt',
        validUntil,
        daysUntilExpiry,
        status,
      });
    }

    return result.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [certifications]);

  const columns = useMemo(() => ({
    expired: expiringCertifications.filter(c => c.status === 'expired'),
    critical: expiringCertifications.filter(c => c.status === 'critical'),
    upcoming: expiringCertifications.filter(c => c.status === 'warning' || c.status === 'ok'),
  }), [expiringCertifications]);

  const handleClick = (id: string) => navigate(`/certifications/${id}`);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-warning" />
            Ablaufende Zertifikate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  if (expiringCertifications.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-success" />
            Ablaufende Zertifikate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              Keine Zertifikate laufen in den nächsten 90 Tagen ab
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-warning" />
          Ablaufende Zertifikate
          <Badge variant="secondary" className="text-[11px] px-2 py-0 ml-auto font-medium">
            nächste 90 Tage
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KanbanColumn
            title="Abgelaufen"
            icon={AlertTriangle}
            items={columns.expired}
            accentClass="border-destructive text-destructive"
            badgeVariant="destructive"
            emptyText="Keine abgelaufenen"
            onItemClick={handleClick}
          />
          <KanbanColumn
            title="Kritisch (≤30d)"
            icon={Clock}
            items={columns.critical}
            accentClass="border-warning text-warning"
            badgeVariant="outline"
            emptyText="Keine kritischen"
            onItemClick={handleClick}
          />
          <KanbanColumn
            title="Bald fällig (≤90d)"
            icon={CalendarClock}
            items={columns.upcoming}
            accentClass="border-primary text-primary"
            badgeVariant="secondary"
            emptyText="Keine bevorstehenden"
            onItemClick={handleClick}
          />
        </div>
      </CardContent>
    </Card>
  );
};
