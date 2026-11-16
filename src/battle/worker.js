import { TournamentEngine } from './engine.js';

let engine;

self.onmessage = (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'init') {
      engine?.destroy();
      engine = new TournamentEngine(e.data.setup);
      self.postMessage({ id, reply: engine.initial() });
    } else {
      if (!engine) throw Error('Battle worker is not initialized.');
      self.postMessage({ id, reply: engine.choose(e.data.action) });
    }
  } catch (err) {
    self.postMessage({ id, fatal: err instanceof Error ? err.message : 'Battle engine failed.' });
  }
};
