'use client';

import { useState } from 'react';
import { Copy, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DemoLinkForm() {
  const [label, setLabel] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setIssuedUrl(null);
    try {
      const res = await fetch('/api/admin/demo-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), ttlHours }),
      });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? '링크 발급 실패');
      }
      setIssuedUrl(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '링크 발급 실패');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!issuedUrl) return;
    try {
      await navigator.clipboard.writeText(issuedUrl);
      toast.success('링크를 복사했습니다.');
    } catch {
      toast.error('복사에 실패했습니다. 링크를 직접 선택해 복사하세요.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-end sm:gap-3"
      >
        <div className="flex-1 space-y-2">
          <Label htmlFor="demo-label">대상자 라벨</Label>
          <Input
            id="demo-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="demo-hong"
            autoFocus
          />
        </div>
        <div className="w-full space-y-2 sm:w-32">
          <Label htmlFor="demo-ttl">TTL (시간)</Label>
          <Input
            id="demo-ttl"
            type="number"
            min={1}
            max={24 * 14}
            value={ttlHours}
            onChange={(e) => setTtlHours(Number(e.target.value) || 24)}
          />
        </div>
        <Button type="submit" disabled={busy || !label.trim()}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Link2 className="size-4" />
          )}
          링크 발급
        </Button>
      </form>

      {issuedUrl && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-xs font-medium text-text-muted">
            생성된 링크 — 이 화면을 벗어나면 다시 볼 수 없습니다.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={issuedUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="default" onClick={handleCopy}>
              <Copy className="size-4" />
              복사
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
