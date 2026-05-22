'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      <LogOut className="size-3.5" />
      로그아웃
    </Button>
  );
}
