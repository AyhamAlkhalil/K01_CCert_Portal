import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => (
  <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6', className)}>
    <div className="min-w-0">
      <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.01em] text-foreground sm:text-[30px]">
        {title}
      </h1>
      {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);
