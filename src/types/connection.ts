export type AuthMethod = "key" | "password";

export type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  key_path: string | null;
};

export type ConnectionSaveInput = {
  id?: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string | null;
  secret: string | null;
  sudoPassword: string | null;
};
