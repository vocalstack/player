import { useEffect, useState } from 'react';

export function useDesk(forced?: boolean): boolean {
  const [desk, setDesk] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 880));
  useEffect(() => {
    if (forced != null) return;
    const on = () => setDesk(window.innerWidth >= 880);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [forced]);
  return forced ?? desk;
}
