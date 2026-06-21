export type FirewallStatus = {
  backend: string;
  available: boolean;
  manageable: boolean;
  enabled: boolean | null;
  needs_privileges: boolean;
  message: string | null;
};

export type FirewallRule = {
  id: string;
  label: string;
  port: string;
  protocol: string;
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
