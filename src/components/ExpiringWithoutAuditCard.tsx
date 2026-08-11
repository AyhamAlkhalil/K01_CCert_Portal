import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CalendarX2, AlertTriangle, Clock, HelpCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useCertificationRisks } from '@/hooks/useCertificationRisks';
import { CertificationRisk, CertificationRiskType } from '@/lib/certificationRisk';

const TYPE_CONFIG: Record<CertificationRiskType, {
  icon: React.ElementType;
  label: string;
  badgeVariant: 'destructive' | 'outline' | 'secondary';
}> = {
  expiring: { icon: Clock, label: 'Läuft ab', badgeVariant: 'destructive' },
  expired: { icon: AlertTriangle, label: 'Abgelaufen', badgeVariant: 'destructive' },
  no_expiry_date: { icon: HelpCircle, label: 'Kein Ablaufdatum', badgeVariant: 'outline' },
};

const formatDeadline = (risk: CertificationRisk): string => {
  if (risk.daysUntilExpiry === null) return 'nicht hinterlegt';
  if (risk.daysUntilExpiry < 0) return `seit ${Math.abs(risk.daysUntilExpiry)} Tagen abgelaufen`;
  if (risk.daysUntilExpiry === 0) return 'läuft heute ab';
  return `in ${risk.daysUntilExpiry} Tagen`;
};

const CardShell = ({ children, count }: { children: React.ReactNode; count?: number }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center justify-between text-base">
        <div className="flex items-center gap-2">
          <CalendarX2 className="h-4 w-4 text-destructive" />
          Ablauf ohne Anschlussaudit
        </div>
        {count !== undefined && count > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            {count} offen
          </Badge>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">{children}</CardContent>
  </Card>
);

export const ExpiringWithoutAuditCard = () => {
  const navigate = useNavigate();
  const { data: risks = [], isLoading, isError, error } = useCertificationRisks();

  const stats = useMemo(() => ({
    expiring: risks.filter((r) => r.type === 'expiring').length,
    expired: risks.filter((r) => r.type === 'expired').length,
    noDate: risks.filter((r) => r.type === 'no_expiry_date').length,
  }), [risks]);

  if (isLoading) {
    return <CardShell><div className="text-sm text-muted-foreground">Laden...</div></CardShell>;
  }

  // Bewusst als Fehler dargestellt: eine leere Liste wäre hier nicht von "alles geplant" zu unterscheiden.
  if (isError) {
    return (
      <CardShell>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Die Fristenprüfung konnte nicht geladen werden — diese Liste ist derzeit <strong>nicht</strong> aussagekräftig.
            {error instanceof Error && <span className="block mt-1 text-xs opacity-80">{error.message}</span>}
          </AlertDescription>
        </Alert>
      </CardShell>
    );
  }

  if (risks.length === 0) {
    return (
      <CardShell>
        <div className="text-center py-6">
          <ShieldCheck className="h-10 w-10 mx-auto text-green-500/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Für alle ablaufenden Zertifizierungen ist ein Audit geplant.
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell count={risks.length}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {stats.expiring > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            {stats.expiring} läuft bald ab
          </Badge>
        )}
        {stats.expired > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 opacity-80">
            {stats.expired} bereits abgelaufen
          </Badge>
        )}
        {stats.noDate > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {stats.noDate} ohne Ablaufdatum
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[420px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs h-8 w-8 px-2"></TableHead>
              <TableHead className="text-xs h-8">Kunde</TableHead>
              <TableHead className="text-xs h-8">Zertifikat</TableHead>
              <TableHead className="text-xs h-8">Gültig bis</TableHead>
              <TableHead className="text-xs h-8 text-right">Frist</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk) => {
              const config = TYPE_CONFIG[risk.type];
              const Icon = config.icon;
              return (
                <TableRow
                  key={risk.clientCertificationId}
                  className={`cursor-pointer text-xs ${risk.type === 'expiring' ? 'bg-destructive/[0.04]' : ''}`}
                  onClick={() => navigate(`/certifications/${risk.clientCertificationId}`)}
                >
                  <TableCell className="py-2 px-2 w-8">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="py-2 font-medium truncate max-w-[160px]">
                    {risk.clientName}
                  </TableCell>
                  <TableCell className="py-2 truncate max-w-[110px] text-muted-foreground">
                    {risk.certificationName}
                  </TableCell>
                  <TableCell className="py-2 text-muted-foreground tabular-nums">
                    {risk.validUntil ? format(risk.validUntil, 'dd.MM.yyyy') : '–'}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Badge variant={config.badgeVariant} className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                      {formatDeadline(risk)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </CardShell>
  );
};
