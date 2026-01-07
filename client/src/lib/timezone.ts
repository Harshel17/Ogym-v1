export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimezoneHeaders(): Record<string, string> {
  return {
    'X-Local-Date': getLocalDate(),
    'X-Local-Timezone': getLocalTimezone()
  };
}

export function formatDateLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTimeLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
