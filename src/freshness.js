import { useEffect, useState } from 'react';

export const formatAge = (retrievedAt, now = Date.now()) => {
  if (!retrievedAt) return 'age unavailable';
  const minutes = Math.max(0, Math.round((now - new Date(retrievedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export const useMinuteNow = (enabled) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [enabled]);
  return now;
};
