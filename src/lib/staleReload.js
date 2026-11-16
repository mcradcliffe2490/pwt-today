// After a deploy, an open tab may ask for hashed chunks that no longer exist.
// Reload once (at most every 10 s) to pick up the new build.
const KEY = 'pwttoday_reloaded_at';
let reloading = false;

export class StaleAssetError extends Error {}

export const isStaleImportError = (err) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(err instanceof Error ? err.message : String(err));

export const isReloading = () => reloading;

export function reloadOnce() {
  if (reloading) return true;
  try {
    const now = Date.now();
    if (now - Number(sessionStorage.getItem(KEY)) < 1e4) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  reloading = true;
  window.location.reload();
  return true;
}

export const installPreloadErrorHandler = () => window.addEventListener('vite:preloadError', reloadOnce);
