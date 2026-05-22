'use client';

import { useEffect, useState } from 'react';

/**
 * SSR 하이드레이션 미스매치 회피용 가드.
 * Zustand persist + localStorage 처럼 클라이언트에서만 알 수 있는 상태를
 * 그리는 컴포넌트는 mount 전까지 일관된(placeholder) UI를 보여줘야 한다.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
