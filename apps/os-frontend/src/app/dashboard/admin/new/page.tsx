'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, setAppAccess, getApplications } from '@/lib/api';
import api from '@/lib/api';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

type Step = 1 | 2;

interface AppOption {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
}

type AppSelections = Record<string, { enabled: boolean; isAppAdmin: boolean }>;

export default function NewUserPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [departments, setDepartments] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [apps, setApps] = useState<AppOption[]>([]);
  const [appSelections, setAppSelections] = useState<AppSelections>({});
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    user_type: 'employee' as 'employee' | 'client',
    department_id: '',
    org_id: '',
    is_team_lead: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/departments').then((r) => setDepartments(r.data));
    getApplications().then(setApps);
  }, []);

  useEffect(() => {
    if (form.user_type !== 'client') return;

    setAppSelections((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).map(([slug, selection]) => [
          slug,
          {
            ...selection,
            isAppAdmin: false,
          },
        ]),
      );

      return next;
    });
  }, [form.user_type]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleApp(slug: string) {
    setAppSelections((prev) => {
      const current = prev[slug];
      if (current?.enabled) {
        return {
          ...prev,
          [slug]: {
            enabled: false,
            isAppAdmin: false,
          },
        };
      }

      return {
        ...prev,
        [slug]: {
          enabled: true,
          isAppAdmin: current?.isAppAdmin ?? false,
        },
      };
    });
  }

  function toggleAppAdmin(slug: string) {
    setAppSelections((prev) => ({
      ...prev,
      [slug]: {
        enabled: true,
        isAppAdmin: !(prev[slug]?.isAppAdmin ?? false),
      },
    }));
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStep(2);
  }

  async function handleFinish() {
    setError('');

    // Validation: if app admin or team lead is true, department must be assigned
    const hasAppAdmin = Object.values(appSelections).some((s) => s.enabled && s.isAppAdmin);
    if ((hasAppAdmin || form.is_team_lead) && !form.department_id) {
      setError('A Department must be assigned if the user is a Team Lead or App Admin.');
      return;
    }

    setLoading(true);
    try {
      const created = await createUser({
        ...form,
        department_id: form.department_id || undefined,
        org_id: form.org_id || undefined,
      });
      for (const [slug, selection] of Object.entries(appSelections)) {
        if (!selection.enabled) continue;
        await setAppAccess(
          created.id,
          slug,
          true,
          form.user_type === 'client' ? false : selection.isAppAdmin,
        );
      }
      router.push('/dashboard/admin');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' };
  const selectedAppsCount = Object.values(appSelections).filter((selection) => selection.enabled).length;

  function StepIndicator() {
    return (
      <div className="flex items-center gap-2 mb-6">
        {([1, 2] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: step >= s ? '#1B3A6C' : '#E2E8F0', color: step >= s ? '#fff' : '#94A3B8' }}
            >
              {s}
            </div>
            <span className="text-xs font-medium" style={{ color: step >= s ? '#1B3A6C' : '#94A3B8' }}>
              {s === 1 ? 'Basic Details' : 'App Access'}
            </span>
            {s < 2 && <span style={{ color: '#E2E8F0' }}>›</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="w-full min-h-full py-10 px-6 lg:px-8 2xl:px-10">
        <div className="w-full bg-white rounded-2xl p-8 lg:p-10" style={{ border: '1px solid #E2E8F0' }}>
          <StepIndicator />

          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a202c' }}>Create New User</h1>
              <p className="text-sm mb-6" style={{ color: '#4338CA' }}>Step 1 of 2: Fill in the basic details.</p>

              <form onSubmit={handleStep1Submit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] gap-8 items-start">
                  <div className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Full Name</label>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <input type="text" required value={form.name} onChange={(e) => set('name', e.target.value)}
                          placeholder="e.g. John Doe"
                          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                          style={inputStyle}
                          onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                          onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Email Address</label>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)}
                          placeholder="example@company.com"
                          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                          style={inputStyle}
                          onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                          onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                        />
                      </div>
                    </div>

                    {/* User Type + Password */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>User Type</label>
                        <select value={form.user_type} onChange={(e) => set('user_type', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                          style={inputStyle}
                        >
                          <option value="employee">Employee</option>
                          <option value="client">Client</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Temporary Password</label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} required minLength={8}
                            value={form.password} onChange={(e) => set('password', e.target.value)}
                            placeholder="Password"
                            className="w-full pl-3 pr-9 py-2.5 rounded-lg text-sm focus:outline-none"
                            style={inputStyle}
                            onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                            onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                          />
                          <button type="button" onClick={() => setShowPassword((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#CBD5E1' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {showPassword
                                ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Department */}
                    {form.user_type !== 'client' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Department</label>
                          <select value={form.department_id} onChange={(e) => set('department_id', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                            style={inputStyle}
                          >
                            <option value="">No department</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between gap-3 p-4 rounded-xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#1a202c' }}>Department Team Lead</p>
                            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Designates this user as the manager of their assigned department.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, is_team_lead: !prev.is_team_lead }))}
                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                            style={{ backgroundColor: form.is_team_lead ? '#1B3A6C' : '#CBD5E1' }}
                            aria-pressed={form.is_team_lead ? 'true' : 'false'}
                          >
                            <span
                              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                              style={{ transform: form.is_team_lead ? 'translateX(24px)' : 'translateX(4px)' }}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Client Org ID */}
                    {form.user_type === 'client' && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Client Organization ID</label>
                        <input type="text" value={form.org_id} onChange={(e) => set('org_id', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                          style={inputStyle}
                          placeholder="UUID of client organization"
                          onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                          onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl p-5 lg:sticky lg:top-24" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#94A3B8' }}>Summary</p>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p style={{ color: '#94A3B8' }}>User</p>
                        <p className="font-semibold" style={{ color: '#1a202c' }}>{form.name || 'New user'}</p>
                      </div>
                      <div>
                        <p style={{ color: '#94A3B8' }}>Email</p>
                        <p className="font-medium break-all" style={{ color: '#1a202c' }}>{form.email || 'Not set yet'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p style={{ color: '#94A3B8' }}>Type</p>
                          <p className="font-medium capitalize" style={{ color: '#1a202c' }}>{form.user_type}</p>
                        </div>
                        <div>
                          <p style={{ color: '#94A3B8' }}>Department</p>
                          <p className="font-medium" style={{ color: '#1a202c' }}>
                            {form.user_type === 'client'
                              ? 'Client linked'
                              : departments.find((department) => department.id === form.department_id)?.name ?? 'No department'}
                          </p>
                        </div>
                      </div>
                      <div className="pt-3 border-t" style={{ borderColor: '#E2E8F0' }}>
                        <p className="text-xs leading-5" style={{ color: '#64748B' }}>
                          {form.user_type === 'client'
                            ? 'Step 2 lets you grant application access. Client users cannot be app admins.'
                            : 'Step 2 lets you grant application access and mark the user as an app admin per application.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                  <button type="button" onClick={() => router.back()}
                    className="w-full sm:w-auto sm:min-w-36 py-2.5 px-5 rounded-lg text-sm font-medium border"
                    style={{ borderColor: '#E2E8F0', color: '#475569' }}
                  >
                    Cancel
                  </button>
                  <button type="submit"
                    className="w-full sm:w-auto sm:min-w-56 flex items-center justify-center gap-2 py-3 px-5 rounded-lg text-white text-sm font-semibold"
                    style={{ backgroundColor: '#1B3A6C' }}
                  >
                    Next: App Assignment
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a202c' }}>Assign Applications</h1>
              <p className="text-sm mb-4" style={{ color: '#4338CA' }}>
                {form.user_type === 'client'
                  ? 'Step 2 of 2: Choose which apps this client user can access.'
                  : 'Step 2 of 2: Choose which apps this user can access and whether they should be an app admin.'}
              </p>

              {/* Summary banner */}
              <div className="rounded-lg px-4 py-3 mb-5 flex items-center gap-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: '#1B3A6C' }}>
                  {form.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1a202c' }}>{form.name}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    {form.email} · {form.user_type}
                    {form.user_type !== 'client' && ` · ${departments.find((department) => department.id === form.department_id)?.name ?? 'No department'}`}
                  </p>
                </div>
              </div>

              {/* App toggles */}
              <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-6 mb-5 items-start">
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                {apps.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: '#94A3B8' }}>No active applications found.</p>
                )}
                {apps.map((app) => {
                  const selection = appSelections[app.slug];
                  const selected = selection?.enabled ?? false;
                  return (
                    <div
                      key={app.slug}
                      className="rounded-2xl p-4 transition-colors"
                      style={{ border: `1px solid ${selected ? '#4338CA' : '#E2E8F0'}`, backgroundColor: selected ? '#EEF2FF' : '#fff' }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleApp(app.slug)}
                        className="w-full flex items-center gap-3 text-left"
                      >
                        {app.icon_url
                          ? <img src={app.icon_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                          : (
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#F1F5F9' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                            </div>
                          )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: '#1a202c' }}>{app.name}</p>
                          <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{app.slug}</p>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: selected ? '#4338CA' : '#CBD5E1', backgroundColor: selected ? '#4338CA' : 'transparent' }}>
                          {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      </button>
                      {form.user_type !== 'client' && (
                        <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: selected ? '#C7D2FE' : '#E2E8F0' }}>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Grant App Admin Role</p>
                            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Allows this user to manage users and settings inside {app.name}.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAppAdmin(app.slug)}
                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                            style={{ backgroundColor: selected && selection?.isAppAdmin ? '#1B3A6C' : '#CBD5E1' }}
                            aria-pressed={selected && selection?.isAppAdmin ? 'true' : 'false'}
                          >
                            <span
                              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                              style={{ transform: selected && selection?.isAppAdmin ? 'translateX(24px)' : 'translateX(4px)' }}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                <div className="rounded-2xl p-5 h-fit" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#94A3B8' }}>Assignment Summary</p>
                  <p className="text-3xl font-bold" style={{ color: '#1a202c' }}>{selectedAppsCount}</p>
                  <p className="text-sm mb-4" style={{ color: '#64748B' }}>applications selected</p>
                  <div className="space-y-2 text-sm">
                    {apps.filter((app) => appSelections[app.slug]?.enabled).length === 0 && (
                      <p style={{ color: '#94A3B8' }}>No apps selected yet.</p>
                    )}
                    {apps.filter((app) => appSelections[app.slug]?.enabled).map((app) => (
                      <div key={app.slug} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
                        <span className="font-medium truncate" style={{ color: '#1a202c' }}>{app.name}</span>
                        {form.user_type !== 'client' && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: appSelections[app.slug]?.isAppAdmin ? '#DBEAFE' : '#E2E8F0', color: appSelections[app.slug]?.isAppAdmin ? '#1D4ED8' : '#64748B' }}>
                            {appSelections[app.slug]?.isAppAdmin ? 'Admin' : 'Member'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setError(''); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
                  style={{ borderColor: '#E2E8F0', color: '#475569' }}
                >
                  ← Back
                </button>
                <button type="button" onClick={handleFinish} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#1B3A6C' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>

              {selectedAppsCount === 0 && (
                <p className="text-xs text-center mt-3" style={{ color: '#94A3B8' }}>
                  Skipping app assignment — you can assign apps later from the user&apos;s profile.
                </p>
              )}
            </>
          )}

          <p className="text-xs text-center mt-5" style={{ color: '#94A3B8' }}>
            <Link href="/dashboard/admin" style={{ color: '#94A3B8' }}>Users</Link> › New User
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
