import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAllClientCertifications } from '@/hooks/useClientCertifications';
import { Tables } from '@/integrations/supabase/types';

interface ClientCertificationWithClients extends Tables<'client_certifications'> {
  certifications: Tables<'certifications'> | null;
  clients: Pick<Tables<'clients'>, 'id' | 'is_active'> | null;
}

interface CertificationYearStat {
  name: string;
  count: number;
}

export const CertificationYearStatsCard = () => {
  const { data: rawCertifications = [], isLoading } = useAllClientCertifications();
  const certifications = rawCertifications as ClientCertificationWithClients[];

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const yearCertifications = certifications.filter((cert) => {
      if (cert.clients?.is_active === false) return false;

      const validFrom = cert.valid_from ? new Date(cert.valid_from) : new Date(cert.created_at);
      const validUntil = cert.valid_until ? new Date(cert.valid_until) : null;

      return validFrom <= yearEnd && (validUntil === null || validUntil >= yearStart);
    });

    const byType = yearCertifications.reduce<Record<string, number>>((acc, cert) => {
      const certificationName = cert.certifications?.name || 'Unbekannt';
      acc[certificationName] = (acc[certificationName] || 0) + 1;
      return acc;
    }, {});

    const sortedTypes: CertificationYearStat[] = Object.entries(byType)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
      .map(([name, count]) => ({ name, count }));

    return {
      total: yearCertifications.length,
      year: currentYear,
      types: sortedTypes,
    };
  }, [certifications]);

  if (isLoading) return null;

  return (
    <Card className="flex flex-col h-full border-teal-500/25 bg-gradient-to-br from-teal-500/[0.07] to-card">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-start justify-between gap-3 text-[15px]">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Zertifikate
          </span>
          <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-teal-700">{stats.total}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Historie {stats.year}</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 flex-1">
        <div className="space-y-2 mt-1">
          {stats.types.length === 0 ? (
            <div className="text-xs text-muted-foreground">Keine Daten im ausgewählten Jahr</div>
          ) : (
            stats.types.map((type) => (
              <div key={type.name} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-muted-foreground">{type.name}</span>
                <span className="font-medium tabular-nums">{type.count}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
