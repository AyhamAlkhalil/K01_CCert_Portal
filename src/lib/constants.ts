import { AuditType, TaskStatus } from '@/types/audit';

// Audit type labels for display
export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  initial: 'Initialaudit',
  surveillance: 'Überwachungsaudit',
  recertification: 'Re-Zertifizierung',
  'six-month': '6-Monats-Überwachung',
  internal: 'Internes Audit',
  training: 'Training',
} as const;

// Audit status configuration
export const AUDIT_STATUS_CONFIG = {
  scheduled: {
    label: 'Geplant',
    variant: 'secondary' as const,
    className: '',
  },
  'in-progress': {
    label: 'In Bearbeitung',
    variant: 'default' as const,
    className: 'bg-amber-500 text-amber-950 border-transparent',
  },
  completed: {
    label: 'Abgeschlossen',
    variant: 'default' as const,
    className: 'bg-success text-success-foreground border-transparent',
  },
  cancelled: {
    label: 'Abgebrochen',
    variant: 'destructive' as const,
    className: '',
  },
} as const;

// Audit status labels for display
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Geplant',
  'in-progress': 'In Bearbeitung',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
} as const;

// Audit status colors for badges
export const AUDIT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'border-border bg-secondary text-secondary-foreground',
  'in-progress': 'border-warning/30 bg-warning/[0.12] text-warning',
  completed: 'border-success/30 bg-success/[0.12] text-success',
  cancelled: 'border-destructive/30 bg-destructive/[0.12] text-destructive',
} as const;

// Task status configuration
export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Ausstehend', color: 'text-secondary-foreground border-transparent', bg: 'bg-secondary' },
  'in-progress': { label: 'In Bearbeitung', color: 'text-amber-950 border-transparent', bg: 'bg-amber-500' },
  completed: { label: 'Abgeschlossen', color: 'text-success-foreground border-transparent', bg: 'bg-success' },
  overdue: { label: 'Überfällig', color: 'text-destructive-foreground border-transparent', bg: 'bg-destructive' },
} as const;

// Timeline status configuration
export const TIMELINE_STATUS_CONFIG = {
  critical: {
    color: 'bg-destructive',
    dotColor: 'bg-destructive',
    textColor: 'text-destructive',
    label: 'Aufgaben überfällig',
    borderClass: 'border-destructive/30 bg-destructive/5',
  },
  imminent: {
    color: 'bg-warning',
    dotColor: 'bg-warning',
    textColor: 'text-warning',
    label: 'In < 7 Tagen',
    borderClass: 'border-warning/30 bg-warning/5',
  },
  upcoming: {
    color: 'bg-primary',
    dotColor: 'bg-primary',
    textColor: 'text-primary',
    label: 'In < 30 Tagen',
    borderClass: 'border-border bg-card',
  },
  planned: {
    color: 'bg-muted-foreground',
    dotColor: 'bg-muted-foreground',
    textColor: 'text-muted-foreground',
    label: 'Geplant',
    borderClass: 'border-border bg-card',
  },
} as const;

// Urgency configuration for tasks - subtle/informational styling
export const URGENCY_CONFIG = {
  overdue: {
    bg: 'bg-muted/50 border-muted-foreground/20',
    text: 'text-muted-foreground',
    badge: 'Überfällig',
  },
  critical: {
    bg: 'bg-muted/30 border-border',
    text: 'text-muted-foreground',
    badge: 'Dringend',
  },
  warning: {
    bg: 'bg-card border-border',
    text: 'text-muted-foreground',
    badge: null,
  },
  normal: {
    bg: 'bg-card border-border',
    text: 'text-muted-foreground',
    badge: null,
  },
} as const;

// Alert severity configuration
export const ALERT_SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-destructive/10 border-destructive/30',
    iconColor: 'text-destructive',
  },
  warning: {
    bg: 'bg-warning/10 border-warning/30',
    iconColor: 'text-warning',
  },
  info: {
    bg: 'bg-info/[0.12] border-info/30',
    iconColor: 'text-info',
  },
} as const;

// Countries list used across client forms
export const COUNTRIES = [
  'Deutschland',
  'Österreich',
  'Rumänien',
  'Italien',
  'Ungarn',
  'Slowenien',
  'Finnland',
  'Litauen',
  'Niederlande',
  'Schweden',
  'Andere',
] as const;
