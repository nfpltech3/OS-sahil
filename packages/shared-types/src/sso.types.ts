export interface SsoPayload {
  // Identity — OS owns these
  token_id: string;
  user_id: string;
  email: string;
  name: string;
  user_type: 'employee' | 'client';

  // Department — OS owns, apps sync on every login
  department_slug: string | null;   // null for client users
  department_name: string | null;   // null for client users

  // App permission — OS decides, apps respect
  is_app_admin: boolean;
  is_team_lead?: boolean;

  // Client org — OS owns, apps filter data by this
  org_id: string | null;
  org_name: string | null;

  iat: number;
  exp: number;
}
