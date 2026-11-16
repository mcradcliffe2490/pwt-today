// Day No. 1 of PWT Today.
export const LAUNCH_DATE = '2026-11-10';

const pad = (n) => String(n).padStart(2, '0');

export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());

export const previousDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d - 1));
};

export const dayNumber = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
};

export const puzzleNumber = (iso) => Math.max(1, dayNumber(iso) - dayNumber(LAUNCH_DATE) + 1);

export const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const msUntilMidnight = (now) => {
  if (now === null) return 0;
  const t = new Date(now);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime() - t.getTime();
};

export const formatCountdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1e3));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};
