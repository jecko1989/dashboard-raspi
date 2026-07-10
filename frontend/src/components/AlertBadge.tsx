import type { Alert } from '../types';

// Badge per un alert, colorato per severita'.
interface AlertBadgeProps {
  alert: Alert;
}

const severityStyles: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

export function AlertBadge({ alert }: AlertBadgeProps) {
  const style = severityStyles[alert.severity] ?? severityStyles.warning;
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${style}`}>
      {alert.type}: {alert.message}
    </span>
  );
}
