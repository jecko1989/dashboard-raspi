import type { ReactNode } from 'react';

// Card per una singola metrica (CPU, RAM, disco, temperatura...).
interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: ReactNode;
}

export function MetricCard({ label, value, hint, trend }: MetricCardProps) {
  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-4">
      {trend && (
        <div className="absolute inset-x-0 bottom-0 z-0 opacity-70">
          {trend}
        </div>
      )}
      <div className="pointer-events-none relative z-10">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="mt-1 break-words text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}
