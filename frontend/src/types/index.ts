// Tipi condivisi allineati agli schemi Pydantic del backend.

export interface Luogo {
  id: string;
  name: string;
  device_count: number;
  display_order?: number;
}

export interface Device {
  id: string;
  name: string;
  hostname: string;
  ip_vpn: string;
  description: string | null;
  luogo_id: string;
  ssh_username: string;
  ssh_port: number;
  is_online: boolean;
  alerts_muted: boolean;
  last_latency_ms: number | null;
  last_checked_at: string | null;
  last_metric_at: string | null;
  tags: string[];
  display_order?: number;
  ssh_command: string | null;
}

// Payload per la creazione di un device (i campi runtime non sono impostabili).
export interface DeviceCreatePayload {
  id: string;
  name: string;
  hostname: string;
  ip_vpn: string;
  luogo_id: string;
  ssh_username: string;
  ssh_port: number;
  description?: string | null;
  tags?: string[];
}

// Payload per la modifica di un device (l'id e' immutabile).
export interface DeviceUpdatePayload {
  name: string;
  hostname: string;
  ip_vpn: string;
  luogo_id: string;
  ssh_username: string;
  ssh_port: number;
  description?: string | null;
  tags?: string[];
}

// Payload per la creazione di un luogo.
export interface LuogoCreatePayload {
  id: string;
  name: string;
  display_order?: number;
}

// Payload per la modifica di un luogo (l'id e' immutabile).
export interface LuogoUpdatePayload {
  name: string;
  display_order?: number | null;
}

export interface Metric {
  id: number;
  device_id: string;
  collected_at: string;
  cpu_percent: number | null;
  ram_percent: number | null;
  disk_percent: number | null;
  temperature_celsius: number | null;
  load_average_1m: number | null;
  uptime_seconds: number | null;
  fan_rpm: number | null;
  fan_mode: string | null;
  os_version: string | null;
  kernel: string | null;
}

export interface ServiceStatus {
  name: string;
  active: boolean;
  status: string;
}

export interface Alert {
  id: number;
  device_id: string;
  type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface DashboardEvent {
  id: number;
  device_id: string | null;
  type: string;
  message: string;
  created_at: string;
}

export interface EventFilters {
  deviceId?: string;
  luogoId?: string;
  sinceHours?: number;
}

export interface Thresholds {
  temperature_celsius: number;
  disk_percent: number;
  ram_percent: number;
  cpu_percent: number;
  offline_after_failures: number;
}

export interface ThresholdsUpdatePayload {
  temperature_celsius: number;
  disk_percent: number;
  ram_percent: number;
  cpu_percent: number;
  offline_after_failures: number;
}

export interface CommandResult {
  device_id: string;
  command: string;
  status: string;
  detail: string | null;
}

export interface SSHKeyResult {
  device_id: string;
  public_key: string;
  key_path: string;
  saved: boolean;
  private_key: string | null;
  install_command: string;
  manual_hint: string;
  detail: string | null;
}

export interface ServiceLogs {
  service: string;
  logs: string;
}

export interface CommandAudit {
  id: number;
  device_id: string;
  requested_by: string | null;
  command: string;
  target: string | null;
  status: string;
  detail: string | null;
  created_at: string;
}
