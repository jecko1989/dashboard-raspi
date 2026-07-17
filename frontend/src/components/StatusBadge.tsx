// Badge stato online/offline.
interface StatusBadgeProps {
  online: boolean;
  dotOnly?: boolean;
}

export function StatusBadge({ online, dotOnly = false }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center ${
        dotOnly ? 'gap-0 rounded-full p-1' : 'gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium'
      } ${
        online
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      }`}
      aria-label={online ? 'Online' : 'Offline'}
      title={online ? 'Online' : 'Offline'}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`}
      />
      {!dotOnly && (online ? 'Online' : 'Offline')}
    </span>
  );
}
