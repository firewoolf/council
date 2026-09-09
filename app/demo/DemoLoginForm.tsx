'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { writeStoredTicket } from '@/components/access/AccessTicketBridge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DemoLoginForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      const res = await fetch('/api/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data: { ticket?: string; error?: string } = await res.json();
      if (!res.ok || !data.ticket) {
        throw new Error(data.error ?? '비밀번호가 일치하지 않습니다.');
      }

      // AccessTicketBridge 의 저장소 헬퍼로만 접근 — #t= URL 진입 경로와 같은
      // 저장소(localStorage)를 보게 한다. 비밀번호는 여기 어디에도 남기지 않는다.
      writeStoredTicket(data.ticket);

      // 전체 새로고침으로 이동 — 루트 레이아웃의 AccessTicketBridge 가 마운트되며
      // 저장된 티켓을 복원 경로로 집어 든다(클라이언트 라우팅으로는 이미 마운트된
      // 레이아웃의 이펙트가 다시 안 돈다).
      window.location.href = '/';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '비밀번호가 일치하지 않습니다.');
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <KeyRound className="size-10 text-primary" />
        <h1 className="text-2xl font-bold text-text">COUNCIL 데모</h1>
        <p className="text-sm text-text-muted">
          비밀번호를 입력하면 키 등록 없이 바로 토론을 시작할 수 있습니다.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="demo-password">비밀번호</Label>
          <Input
            id="demo-password"
            type="password"
            autoComplete="off"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="DEMO_PASSWORD"
          />
        </div>
        <Button type="submit" disabled={busy || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : '입장'}
        </Button>
      </form>
    </section>
  );
}
