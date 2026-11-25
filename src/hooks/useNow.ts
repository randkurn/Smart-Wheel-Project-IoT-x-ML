import { useEffect, useState } from 'react';

/** Jam yang berdetak — dipakai untuk menghitung umur data & status STALE. */
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
