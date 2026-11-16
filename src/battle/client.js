import BattleWorker from './worker.js?worker';
import { StaleAssetError } from '../lib/staleReload.js';

// Promise-based RPC over the battle worker. Any failure poisons the client.
export class BattleClient {
  worker = new BattleWorker();
  next = 0;
  initId = 0;
  initReplied = false;
  failure;
  pending = new Map();

  constructor() {
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      if (data.id === this.initId) this.initReplied = true;
      clearTimeout(p.timer);
      this.pending.delete(data.id);
      if (data.fatal) p.reject(Error(data.fatal));
      else p.resolve(data.reply);
    };
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.fail(
        this.initReplied
          ? Error('The battle worker stopped unexpectedly.')
          : new StaleAssetError('The battle worker stopped unexpectedly.'),
      );
    };
    this.worker.onmessageerror = () => this.fail(Error('The battle worker returned invalid data.'));
  }

  fail(err) {
    this.failure = err;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
    this.worker.terminate();
  }

  send(msg) {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.next;
    if (msg.type === 'init') this.initId = id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(Error('The battle worker did not respond.')), 3e4);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, ...msg });
    });
  }

  init(setup) {
    return this.send({ type: 'init', setup });
  }

  choose(action) {
    return this.send({ type: 'choose', action });
  }

  dispose() {
    this.fail(Error('Battle closed.'));
  }
}
