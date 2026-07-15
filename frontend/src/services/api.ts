import axios from 'axios';
import type {
  Luogo,
  Device,
  DeviceCreatePayload,
  DeviceUpdatePayload,
  LuogoCreatePayload,
  LuogoUpdatePayload,
  Alert,
  DashboardEvent,
  EventFilters,
  Metric,
  Thresholds,
  ThresholdsUpdatePayload,
  ServiceStatus,
  ServiceLogs,
  CommandResult,
  CommandAudit,
  SSHKeyResult,
} from '../types';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const TOKEN_KEY = 'rpi_token';

export const api = axios.create({
  baseURL: `${baseURL}/api`,
});

// Aggiunge automaticamente il token JWT alle richieste.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Su 401: token scaduto/mancante -> pulisce e notifica l'app.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  },
);

// --- Autenticazione ----------------------------------------------------------

export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post<{ access_token: string }>('/auth/login', {
    username,
    password,
  });
  return data.access_token;
}

export async function getMe(): Promise<{ username: string; is_admin: boolean }> {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function getLuoghi(): Promise<Luogo[]> {
  const { data } = await api.get<Luogo[]>('/luoghi');
  return data;
}

export async function getDevices(luogoId?: string): Promise<Device[]> {
  const { data } = await api.get<Device[]>('/devices', {
    params: luogoId ? { luogo_id: luogoId } : undefined,
  });
  return data;
}

export async function getDevice(id: string): Promise<Device> {
  const { data } = await api.get<Device>(`/devices/${id}`);
  return data;
}

// Crea un nuovo device. Emette 'devices:changed' cosi' sidebar/overview si
// aggiornano senza refresh manuale.
export async function createDevice(payload: DeviceCreatePayload): Promise<Device> {
  const { data } = await api.post<Device>('/devices', payload);
  window.dispatchEvent(new Event('devices:changed'));
  return data;
}

// Aggiorna un device esistente (id immutabile).
export async function updateDevice(
  id: string,
  payload: DeviceUpdatePayload,
): Promise<Device> {
  const { data } = await api.put<Device>(`/devices/${id}`, payload);
  window.dispatchEvent(new Event('devices:changed'));
  return data;
}

// Elimina un device.
export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`);
  window.dispatchEvent(new Event('devices:changed'));
}

// --- Luoghi ------------------------------------------------------------------

export async function createLuogo(payload: LuogoCreatePayload): Promise<Luogo> {
  const { data } = await api.post<Luogo>('/luoghi', payload);
  window.dispatchEvent(new Event('devices:changed'));
  return data;
}

export async function updateLuogo(
  id: string,
  payload: LuogoUpdatePayload,
): Promise<Luogo> {
  const { data } = await api.put<Luogo>(`/luoghi/${id}`, payload);
  window.dispatchEvent(new Event('devices:changed'));
  return data;
}

export async function deleteLuogo(id: string): Promise<void> {
  await api.delete(`/luoghi/${id}`);
  window.dispatchEvent(new Event('devices:changed'));
}

export async function getLatestMetric(deviceId: string): Promise<Metric | null> {
  const { data } = await api.get<Metric | null>(`/devices/${deviceId}/metrics/latest`);
  return data;
}

export async function getMetricHistory(
  deviceId: string,
  limit = 100,
): Promise<Metric[]> {
  const { data } = await api.get<Metric[]>(`/devices/${deviceId}/metrics/history`, {
    params: { limit },
  });
  return data;
}

export async function checkDevice(deviceId: string): Promise<Device> {
  const { data } = await api.post<Device>(`/devices/${deviceId}/check`);
  return data;
}

export async function refreshAll(): Promise<void> {
  await api.post('/monitoring/refresh');
}

export async function muteDeviceAlerts(deviceId: string): Promise<Device> {
  const { data } = await api.post<Device>(`/devices/${deviceId}/alerts/mute`);
  return data;
}

export async function unmuteDeviceAlerts(deviceId: string): Promise<Device> {
  const { data } = await api.post<Device>(`/devices/${deviceId}/alerts/unmute`);
  return data;
}

export async function getAlerts(activeOnly = true): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>('/alerts', {
    params: { active_only: activeOnly },
  });
  return data;
}

export async function getEvents(
  limit = 50,
  filters?: EventFilters,
): Promise<DashboardEvent[]> {
  const { data } = await api.get<DashboardEvent[]>('/events', {
    params: {
      limit,
      device_id: filters?.deviceId,
      luogo_id: filters?.luogoId,
      since_hours: filters?.sinceHours,
    },
  });
  return data;
}

export async function getEventsCount(filters?: EventFilters): Promise<number> {
  const { data } = await api.get<{ count: number }>('/events/count', {
    params: {
      device_id: filters?.deviceId,
      luogo_id: filters?.luogoId,
      since_hours: filters?.sinceHours,
    },
  });
  return data.count;
}

export async function clearEvents(filters?: EventFilters): Promise<number> {
  const { data } = await api.delete<{ deleted: number }>('/events', {
    params: {
      device_id: filters?.deviceId,
      luogo_id: filters?.luogoId,
    },
  });
  return data.deleted;
}

export async function getThresholds(): Promise<Thresholds> {
  const { data } = await api.get<Thresholds>('/settings/thresholds');
  return data;
}

export async function updateThresholds(
  payload: ThresholdsUpdatePayload,
): Promise<Thresholds> {
  const { data } = await api.put<Thresholds>('/settings/thresholds', payload);
  return data;
}

// --- Servizi -----------------------------------------------------------------

export async function getServices(deviceId: string): Promise<ServiceStatus[]> {
  const { data } = await api.get<ServiceStatus[]>(`/devices/${deviceId}/services`);
  return data;
}

export async function getServiceLogs(
  deviceId: string,
  serviceName: string,
): Promise<ServiceLogs> {
  const { data } = await api.get<ServiceLogs>(
    `/devices/${deviceId}/services/${serviceName}/logs`,
  );
  return data;
}

// --- Comandi remoti (richiedono conferma) -----------------------------------

export async function commandReboot(deviceId: string): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/commands/reboot`,
    { confirm: true },
  );
  return data;
}

export async function commandShutdown(deviceId: string): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/commands/shutdown`,
    { confirm: true },
  );
  return data;
}

export async function commandUpdate(
  deviceId: string,
  dryRun: boolean,
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/commands/update`,
    { confirm: true, dry_run: dryRun },
  );
  return data;
}

export async function commandRestartService(
  deviceId: string,
  serviceName: string,
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/services/${serviceName}/restart`,
    { confirm: true },
  );
  return data;
}

export async function commandStartService(
  deviceId: string,
  serviceName: string,
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/services/${serviceName}/start`,
    { confirm: true },
  );
  return data;
}

export async function commandStopService(
  deviceId: string,
  serviceName: string,
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/services/${serviceName}/stop`,
    { confirm: true },
  );
  return data;
}

export async function commandTailscale(
  deviceId: string,
  opts: { exitNode: boolean; routes: boolean },
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/commands/tailscale`,
    { confirm: true, exit_node: opts.exitNode, routes: opts.routes },
  );
  return data;
}

export async function commandMyst(
  deviceId: string,
  action: 'start' | 'stop',
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/commands/myst`,
    { confirm: true, action },
  );
  return data;
}

export async function commandFanControl(
  deviceId: string,
  mode: 'pwm' | 'fixed',
  rpm?: number,
): Promise<CommandResult> {
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/commands/fan`,
    {
      confirm: true,
      mode,
      rpm: mode === 'fixed' ? rpm : undefined,
    },
  );
  return data;
}

// --- Chiave SSH --------------------------------------------------------------

export async function generateSSHKey(
  deviceId: string,
  force = false,
): Promise<SSHKeyResult> {
  const { data } = await api.post<SSHKeyResult>(
    `/devices/${deviceId}/ssh-key/generate`,
    { confirm: true, force },
  );
  return data;
}

// --- Backup / ripristino nodo Mysterium --------------------------------------

// Scarica il backup .zip del nodo myst (usa il filename fornito dal server).
export async function downloadMystBackup(deviceId: string): Promise<void> {
  const response = await api.get(`/devices/${deviceId}/myst/backup`, {
    responseType: 'blob',
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `myst-backup-${deviceId}.zip`;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Carica un backup .zip e lo ripristina sul device.
export async function restoreMystBackup(
  deviceId: string,
  file: File,
): Promise<CommandResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('confirm', 'true');
  const { data } = await api.post<CommandResult>(
    `/devices/${deviceId}/myst/restore`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function getAudit(
  deviceId?: string,
  limit = 50,
): Promise<CommandAudit[]> {
  const { data } = await api.get<CommandAudit[]>('/audit', {
    params: { device_id: deviceId, limit },
  });
  return data;
}

// Scarica il CSV delle metriche di un device (con header di autenticazione).
export async function downloadMetricsCsv(deviceId: string): Promise<void> {
  const response = await api.get(`/devices/${deviceId}/metrics/export.csv`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${deviceId}_metrics.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
