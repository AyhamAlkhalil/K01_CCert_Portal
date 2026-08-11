import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Zertifizierungen, die bewusst kein Ablaufdatum haben (Dienstleistungen statt Zertifikate).
 * Für diese ist ein fehlendes valid_until kein Datenfehler.
 * Neue Nicht-Zertifikate hier ergänzen, sonst erscheinen sie als "kein Ablaufdatum".
 */
export const NON_EXPIRING_CERTIFICATIONS = ['Beratung & Begleitung', 'Schulung'];

/**
 * Ein Audit gilt nur dann als Anschlussplanung, wenn es offen ist UND nicht
 * lange in der Vergangenheit liegt. Ein 'scheduled' Audit von vor einem halben Jahr
 * ist ein Planungsartefakt — es wurde nie durchgeführt und nie aktualisiert.
 */
const PAST_AUDIT_GRACE_DAYS = 30;

/** Standard-Vorlauf: so weit in die Zukunft wird nach ungeplanten Abläufen gesucht. */
export const DEFAULT_RISK_HORIZON_DAYS = 180;

export type CertificationRiskType = 'expired' | 'expiring' | 'no_expiry_date';

export interface CertificationRisk {
  clientCertificationId: string;
  clientId: string | null;
  clientName: string;
  certificationName: string;
  validUntil: Date | null;
  /** negativ = seit so vielen Tagen abgelaufen; null = kein Ablaufdatum hinterlegt */
  daysUntilExpiry: number | null;
  type: CertificationRiskType;
}

interface RiskInputAudit {
  status: string | null;
  scheduled_date: string | null;
}

export interface CertificationRiskInput {
  id: string;
  valid_until: string | null;
  certifications: { name: string | null } | null;
  clients: { id: string; name: string | null; is_active: boolean | null } | null;
  audits: RiskInputAudit[] | null;
}

const hasPlannedAudit = (audits: RiskInputAudit[] | null, today: Date): boolean =>
  (audits ?? []).some((audit) => {
    if (audit.status !== 'scheduled' && audit.status !== 'in-progress') return false;
    if (!audit.scheduled_date) return false;
    return differenceInCalendarDays(parseISO(audit.scheduled_date), today) >= -PAST_AUDIT_GRACE_DAYS;
  });

const RISK_ORDER: Record<CertificationRiskType, number> = {
  expiring: 0,
  expired: 1,
  no_expiry_date: 2,
};

/**
 * Findet Zertifizierungen aktiver Kunden, für die kein Anschlussaudit geplant ist:
 * bereits abgelaufen, in den nächsten `horizonDays` ablaufend, oder ganz ohne Ablaufdatum
 * (letztere tauchen in keiner anderen Ablaufwarnung auf).
 */
export const buildCertificationRisks = (
  certifications: CertificationRiskInput[],
  horizonDays: number = DEFAULT_RISK_HORIZON_DAYS,
  today: Date = new Date(),
): CertificationRisk[] => {
  const risks: CertificationRisk[] = [];

  for (const cert of certifications) {
    if (!cert.clients) continue;
    if (cert.clients.is_active === false) continue;
    if (hasPlannedAudit(cert.audits, today)) continue;

    const certificationName = cert.certifications?.name ?? 'Unbekannt';
    const base = {
      clientCertificationId: cert.id,
      clientId: cert.clients.id,
      clientName: cert.clients.name ?? 'Unbekannt',
      certificationName,
    };

    if (!cert.valid_until) {
      if (NON_EXPIRING_CERTIFICATIONS.includes(certificationName)) continue;
      risks.push({ ...base, validUntil: null, daysUntilExpiry: null, type: 'no_expiry_date' });
      continue;
    }

    const validUntil = parseISO(cert.valid_until);
    const daysUntilExpiry = differenceInCalendarDays(validUntil, today);
    if (daysUntilExpiry > horizonDays) continue;

    risks.push({
      ...base,
      validUntil,
      daysUntilExpiry,
      type: daysUntilExpiry < 0 ? 'expired' : 'expiring',
    });
  }

  // Handlungsdringlichkeit: was als nächstes abläuft zuerst, dann frisch Abgelaufenes
  // (dort ist Rettung noch realistisch), zuletzt die reinen Datenlücken.
  return risks.sort((a, b) => {
    const byType = RISK_ORDER[a.type] - RISK_ORDER[b.type];
    if (byType !== 0) return byType;
    if (a.type === 'no_expiry_date') return a.clientName.localeCompare(b.clientName);
    if (a.type === 'expired') return (b.daysUntilExpiry ?? 0) - (a.daysUntilExpiry ?? 0);
    return (a.daysUntilExpiry ?? 0) - (b.daysUntilExpiry ?? 0);
  });
};
