import { useEffect, useState } from 'react';
export function useIsMobile(max = 672) {
  const q = `(max-width: ${max - 1}px)`;
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}
