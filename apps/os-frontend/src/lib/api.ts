import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly cookie on every request
});

export default api;

// ─── Auth ─────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data; // { user, allowed_apps }
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function getMe() {
  const res = await api.get('/users/me');
  return res.data; // { user, allowed_apps }
}

export async function getSsoToken(appSlug: string): Promise<string> {
  const res = await api.get(`/auth/sso-token?app=${appSlug}`);
  return res.data.sso_token;
}

// ─── Users (Admin) ────────────────────────────────────────────────

export async function getUsers() {
  const res = await api.get('/users');
  return res.data;
}

export async function getUser(id: string) {
  const res = await api.get(`/users/${id}`);
  return res.data;
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  user_type: 'employee' | 'client';
  department_id?: string;
  org_id?: string;
  is_team_lead?: boolean;
}) {
  const res = await api.post('/users', data);
  return res.data;
}

export async function updateUser(
  id: string,
  data: { name?: string; is_active?: boolean },
) {
  const res = await api.patch(`/users/${id}`, data);
  return res.data;
}

export async function deleteUser(id: string) {
  const res = await api.delete(`/users/${id}`);
  return res.data;
}

export async function getUserAppAccess(id: string) {
  const res = await api.get(`/users/${id}/app-access`);
  return res.data;
}

export async function setAppAccess(
  userId: string,
  app_slug: string,
  is_enabled: boolean,
  is_app_admin?: boolean,
) {
  const res = await api.post(`/users/${userId}/app-access`, {
    app_slug,
    is_enabled,
    is_app_admin,
  });
  return res.data;
}

export async function setAppAdmin(
  userId: string,
  app_slug: string,
  is_app_admin: boolean,
) {
  const res = await api.post(`/users/${userId}/app-access`, {
    app_slug,
    is_enabled: true,   // keep existing access state
    is_app_admin,
  });
  return res.data;
}

// ─── Apps (Admin) ─────────────────────────────────────────────────
export async function getApplications() {
  const res = await api.get('/users/applications');
  return res.data as Array<{ id: string; slug: string; name: string; url: string; icon_url: string | null }>;
}
export async function getApps() {
  const res = await api.get('/apps');
  return res.data as Array<{
    id: string;
    slug: string;
    name: string;
    url: string;
    icon_url: string | null;
    webhook_url: string | null;
    is_active: boolean;
  }>;
}

export async function createApp(data: { slug: string; name: string; url: string; is_active?: boolean; webhook_url?: string }) {
  const res = await api.post('/apps', data);
  return res.data as { id: string; slug: string; name: string; url: string; icon_url: string | null; is_active: boolean };
}

export async function updateApp(
  id: string,
  data: { name?: string; url?: string; is_active?: boolean; webhook_url?: string | null },
) {
  const res = await api.patch(`/apps/${id}`, data);
  return res.data;
}

export async function deleteApp(id: string) {
  const res = await api.delete(`/apps/${id}`);
  return res.data;
}

export async function uploadAppImage(id: string, blob: Blob, filename = 'image.jpg') {
  const formData = new FormData();
  formData.append('file', blob, filename);
  const res = await api.post(`/apps/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as { id: string; icon_url: string | null };
}

// ─── Departments (Admin) ──────────────────────────────────────────
export async function createDepartment(name: string) {
  const res = await api.post('/users/departments', { name });
  return res.data;
}

export async function updateDepartment(id: string, name: string) {
  const res = await api.patch(`/users/departments/${id}`, { name });
  return res.data;
}

export async function deleteDepartment(id: string) {
  const res = await api.delete(`/users/departments/${id}`);
  return res.data;
}
