import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { installPreloadErrorHandler } from './lib/staleReload.js';
import workerUrl from './battle/worker.js?worker&url';
import './styles.css';

installPreloadErrorHandler();
createRoot(document.getElementById('root')).render(<App />);

// Warm the cache for the battle worker (it bundles the whole simulator) while
// the home screen is idle, so the first battle starts without a long download.
function prefetchWorker() {
  if (document.querySelector('link[data-battle-prefetch]')) return;
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  link.href = workerUrl;
  link.dataset.battlePrefetch = '';
  document.head.append(link);
}
if ('requestIdleCallback' in window) window.requestIdleCallback(prefetchWorker, { timeout: 5e3 });
else setTimeout(prefetchWorker, 2500);
