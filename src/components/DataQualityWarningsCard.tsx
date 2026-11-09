import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, UserX, CalendarX, FileWarning } from 'lucide-react';
import { useAllClientCertifications } from '@/hooks/useClientCertifications';
import { Tables } from '@/integrations/supabase/types';

interface ClientCertificationWithClients extends Tables<'client_certifications'> {
  certifications: Tables<'certifications'> | null;
  clients: Pick<Tables<'clients'>, 'id' | 'name' | 'is_active'> | null;
}

interface DataQualityIssue {
  id: string;
  clientCertificationId: string;
  clientName: string;
  certificationName: string;
  type: 'missing_auditor' | 'missing_validity' | 'missing_both';
  description: string;
}

const TYPE_CONFIG = {
  missing_both: {
    icon: FileWarning,
    label: 'Kritisch: Auditor & Datum fehlen',
    badgeVariant: 'destructive' as const,
  },
  missing_auditor: {
    icon: UserX,
    label: 'Kein Auditor',
    badgeVariant: 'outline' as const,
  },
  missing_validity: {
    icon: CalendarX,
    label: 'Kein Datum',
    badgeVariant: 'outline' as const,
  },
};

export const DataQualityWarningsCard = () => {
  const navigate = useNavigate();
  const { data: rawCertifications = [], isLoading } = useAllClientCertifications();
  const certifications = rawCertifications as ClientCertificationWithClients[];

  const issues = useMemo(() => {
    const result: DataQualityIssue[] = [];

    for (const cert of certifications) {
      // Nur aktive Kunden anzeigen
      if (cert.clients?.is_active === false) continue;
      const hasAuditor = !!cert.auditor_id;
      const hasValidity = !!cert.valid_until;

      if (!hasAuditor && !hasValidity) {
        result.push({
          id: `both-${cert.id}`,
          clientCertificationId: cert.id,
          clientName: cert.clients?.name || 'Unbekannt',
          certificationName: cert.certifications?.name || 'Unbekannt',
          type: 'missing_both',
          description: 'Auditor und Gültigkeitsdatum fehlen',
        });
      } else if (!hasAuditor) {
        result.push({
          id: `auditor-${cert.id}`,
          clientCertificationId: cert.id,
          clientName: cert.clients?.name || 'Unbekannt',
          certificationName: cert.certifications?.name || 'Unbekannt',
          type: 'missing_auditor',
          description: 'Kein Auditor zugewiesen',
        });
      } else if (!hasValidity) {
        result.push({
          id: `validity-${cert.id}`,
          clientCertificationId: cert.id,
          clientName: cert.clients?.name || 'Unbekannt',
          certificationName: cert.certifications?.name || 'Unbekannt',
          type: 'missing_validity',
          description: 'Gültigkeitsdatum fehlt',
        });
      }
    }

    return result.sort((a, b) => {
      const severityOrder = { missing_both: 0, missing_auditor: 1, missing_validity: 2 };
      return severityOrder[a.type] - severityOrder[b.type];
    });
  }, [certifications]);

  const stats = useMemo(() => ({
    missingBoth: issues.filter(i => i.type === 'missing_both').length,
    missingAuditor: issues.filter(i => i.type === 'missing_auditor').length,
    missingValidity: issues.filter(i => i.type === 'missing_validity').length,
    total: issues.length,
  }), [issues]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Datenqualität
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Datenqualität
          </div>
          <div className="flex gap-1.5">
            {stats.missingBoth > 0 && (
              <Badge variant="destructive" className="text-[11px] px-2 py-0 font-medium">
                {stats.missingBoth} kritisch
              </Badge>
            )}
            <Badge variant="secondary" className="text-[11px] px-2 py-0 font-medium">
              {stats.total} gesamt
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[480px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-8 px-2"></TableHead>
                <TableHead className="h-9">Kunde</TableHead>
                <TableHead className="h-9">Zertifikat</TableHead>
                <TableHead className="h-9 text-right">Problem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => {
                const config = TYPE_CONFIG[issue.type];
                const Icon = config.icon;
                return (
                  <TableRow
                    key={issue.id}
                    className={`cursor-pointer text-[13px] ${issue.type === 'missing_both' ? 'bg-destructive/[0.04]' : ''}`}
                    onClick={() => navigate(`/certifications/${issue.clientCertificationId}`)}
                  >
                    <TableCell className="py-2 px-2 w-8">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="py-2 font-medium truncate max-w-[120px]">
                      {issue.clientName}
                    </TableCell>
                    <TableCell className="py-2 truncate max-w-[100px] text-muted-foreground">
                      {issue.certificationName}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Badge variant={config.badgeVariant} className="text-[11px] px-2 py-0">
                        {config.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
