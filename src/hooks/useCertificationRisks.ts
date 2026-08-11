import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildCertificationRisks,
  CertificationRisk,
  CertificationRiskInput,
  DEFAULT_RISK_HORIZON_DAYS,
} from '@/lib/certificationRisk';

/**
 * Zertifizierungen ohne geplantes Anschlussaudit.
 * Lädt client_certifications samt zugehöriger Audits in einer Abfrage —
 * die Verknüpfung "läuft ab" ↔ "Audit geplant?" gibt es sonst nirgends im System.
 */
export const useCertificationRisks = (horizonDays: number = DEFAULT_RISK_HORIZON_DAYS) => {
  return useQuery<CertificationRisk[]>({
    queryKey: ['certification-risks', horizonDays],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_certifications')
        .select(`
          id,
          valid_until,
          certifications ( name ),
          clients ( id, name, is_active ),
          audits ( status, scheduled_date )
        `);

      if (error) throw error;
      return buildCertificationRisks((data ?? []) as CertificationRiskInput[], horizonDays);
    },
  });
};
