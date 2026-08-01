import { redirect } from 'next/navigation';

import { isAdminEnabled, isAuthenticated } from '@/lib/admin/auth';
import { UsageDashboard } from './UsageDashboard';

export const dynamic = 'force-dynamic';

export default function AdminUsagePage() {
  if (!isAdminEnabled()) redirect('/admin');
  if (!isAuthenticated()) redirect('/admin/login');

  return <UsageDashboard />;
}
