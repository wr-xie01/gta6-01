// Save — one clear job: persist progress (money, missions, best stats) in
// localStorage and load it back. The save is a plain JSON object under one key.
import { SAVE_KEY } from './config.js';

export function createSave() {
  return {
    data: null,
    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || typeof d !== 'object') return null;
        this.data = d;
        return d;
      } catch (e) { return null; }
    },
    write(G) {
      const d = {
        money: G.player.money,
        completed: G.missions.completed.slice(),
        best: G.stats.best || {},
        savedAt: new Date().toISOString(),
      };
      // Best stats: most money held at once, most stars survived, missions done.
      d.best.mostMoney = Math.max(G.stats.best.mostMoney || 0, G.player.money);
      d.best.mostStars = Math.max(G.stats.best.mostStars || 0, G.police.stars);
      d.best.missions = Math.max(G.stats.best.missions || 0, G.missions.completed.length);
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); this.data = d; } catch (e) { /* storage full/blocked */ }
    },
    clear() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      this.data = null;
    },
  };
}
