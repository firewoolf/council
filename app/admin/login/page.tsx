'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginShell busy={false} password="" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') ?? '/admin';

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? '로그인 실패');
      }
      router.replace(redirect);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LoginShell busy={busy} password={password}>
      <form onSubmit={handleSubmit} className="contents">
        <div className="space-y-2">
          <Label htmlFor="admin-password">비밀번호</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ADMIN_PASSWORD"
          />
        </div>
        <Button type="submit" disabled={busy || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : '로그인'}
        </Button>
      </form>
    </LoginShell>
  );
}

function LoginShell({
  busy: _busy,
  password: _password,
  children,
}: {
  busy: boolean;
  password: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ShieldCheck className="size-10 text-primary" />
        <h1 className="text-2xl font-bold text-text">어드민 로그인</h1>
        <p className="text-sm text-text-muted">
          페르소나·프롬프트 관리 페이지입니다.
        </p>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        {children}
      </div>
    </section>
  );
}
