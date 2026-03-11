'use client';

import { useAuth } from '@/context/AuthContext';
import { getSsoToken } from '@/lib/api';
import { AppTile } from '@/lib/auth.types';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

function LightningIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
}
function TruckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 5v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}
function GradCapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  );
}

const APP_META: Record<string, { icon: React.ReactNode; bg: string; fg: string }> = {
  shakti:       { icon: <LightningIcon />, bg: '#EDE9FE', fg: '#7C3AED' },
  superfreight: { icon: <TruckIcon />,     bg: '#DBEAFE', fg: '#1D4ED8' },
  tez:          { icon: <CheckIcon />,     bg: '#DBEAFE', fg: '#1B3A6C' },
  trainings:    { icon: <GradCapIcon />,   bg: '#DBEAFE', fg: '#1B3A6C' },
};

const BAR_HEIGHTS = [40, 54, 36, 68, 50, 44, 72, 80];

function AppCard({ app, onClick, loading }: { app: AppTile; onClick: () => void; loading: boolean }) {
  const meta = APP_META[app.slug] ?? { icon: <span style={{ fontSize: 20 }}>📦</span>, bg: '#F1F5F9', fg: '#475569' };
  return (
    <div className="flex flex-col items-center text-center p-5 rounded-xl" style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-center rounded-xl mb-3 overflow-hidden" style={{ width: 56, height: 56, backgroundColor: app.icon_url ? 'transparent' : meta.bg, color: meta.fg }}>
        {app.icon_url
          ? <img src={app.icon_url} alt={app.name} style={{ width: 56, height: 56, objectFit: 'cover' }} />
          : meta.icon}
      </div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="font-semibold text-sm" style={{ color: '#1a202c' }}>{app.name}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block', flexShrink: 0 }} />
      </div>
      <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>{app.url.replace(/^https?:\/\//, '')}</p>
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full text-sm font-medium py-1.5 rounded-lg border transition-colors disabled:opacity-60"
        style={{ borderColor: '#E2E8F0', color: '#475569', backgroundColor: '#fff' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; }}
      >
        {loading ? 'Launching…' : 'Launch App'}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { user, allowed_apps, loading } = useAuth();
  const [launchingSlug, setLaunchingSlug] = useState<string | null>(null);
  const isAdmin = user?.user_type === 'admin';
  const router = useRouter();

  async function handleTileClick(app: AppTile) {
    if (launchingSlug) return;
    if (app.slug === 'shakti') { window.open(app.url, '_blank'); return; }
    setLaunchingSlug(app.slug);
    try {
      const sso_token = await getSsoToken(app.slug);
      window.location.href = `${app.url}/sso?token=${sso_token}`;
    } catch (err) {
      console.error('SSO launch failed', err);
      setLaunchingSlug(null);
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) return null;
  if (!user) return null;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1a202c' }}>
            Good day, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            {allowed_apps.length === 0
              ? 'No applications assigned yet. Contact your admin.'
              : <>You have access to <strong style={{ color: '#4338CA' }}>{allowed_apps.length} active application{allowed_apps.length !== 1 ? 's' : ''}</strong> in your workspace.</>}
          </p>
        </div>

        {allowed_apps.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {allowed_apps.map(app => (
              <AppCard key={app.slug} app={app} onClick={() => handleTileClick(app)} loading={launchingSlug === app.slug} />
            ))}
          </div>
        )}
        {allowed_apps.length === 0 && (
          <div className="text-center py-16 mb-8" style={{ color: '#94A3B8' }}>
            <p className="text-lg font-medium">No apps assigned</p>
            <p className="text-sm mt-1">Contact your administrator to get access.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border" style={{ borderColor: '#E2E8F0' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: '#64748B' }}>Network Traffic (24h)</p>
            <div className="flex items-end gap-2" style={{ height: 80 }}>
              {BAR_HEIGHTS.map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: i === BAR_HEIGHTS.length - 1 ? '#4338CA' : '#BFDBFE' }} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border" style={{ borderColor: '#E2E8F0' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: '#1a202c' }}>Recent Admin Activity</p>
              {isAdmin && <Link href="/dashboard/admin" className="text-xs font-medium" style={{ color: '#4338CA' }}>View All</Link>}
            </div>
            <div className="flex flex-col gap-3">
              {[
                { dot: '#3B82F6', text: 'New user invitation sent for', bold: 'Tez',              time: '2 mins ago' },
                { dot: '#F59E0B', text: 'System maintenance scheduled for', bold: 'Super Freight', time: '1 hour ago' },
                { dot: '#22C55E', text: 'Successfully updated security certificates for all nodes', bold: '', time: '3 hours ago' },
              ].map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2 flex-1">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.dot, marginTop: 5, flexShrink: 0, display: 'inline-block' }} />
                    <p className="text-sm" style={{ color: '#475569' }}>
                      {item.text}{item.bold && <> <strong style={{ color: '#1a202c' }}>{item.bold}</strong></>}
                    </p>
                  </div>
                  <span className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
