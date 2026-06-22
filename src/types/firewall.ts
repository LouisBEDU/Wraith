export type FirewallStatus = {
  backend: string;
  available: boolean;
  manageable: boolean;
  enabled: boolean | null;
  needs_privileges: boolean;
  /** Familles d'adresses gérables (ex. ["v4","v6"] pour ufw, ["any"] pour Windows). */
  ip_versions: string[];
  message: string | null;
};

export type FirewallRule = {
  id: string;
  label: string;
  port: string;
  protocol: string;
  /** "v4", "v6" ou "any". */
  ip_version: string;
  managed: boolean;
};

export type SshStatus = {
  installed: boolean;
  running: boolean | null;
  port: number | null;
  manageable: boolean;
  message: string | null;
};

export type SystemTools = {
  docker: boolean;
  firewall: FirewallStatus;
  ssh: SshStatus;
};
