/**
 * Decides WHEN a KPI module pulls fresh data from SAP.
 *
 *  - The first read after the server starts triggers a live fetch (data is always fresh per app session).
 *  - Concurrent callers share one in-flight fetch (ten users opening the app = one SAP read).
 *  - POST /sync (force) always fetches again.
 *  - If a live fetch fails but an earlier successful sync exists, reads fall back to that data
 *    (flagged stale) and SAP is not retried until the cooldown has passed.
 */
export class SyncCoordinator {
  #inFlight = null;
  #syncedThisProcess = false;
  #lastFailureAt = 0;
  #lastError = null;

  constructor({ runSync, getLastSuccess, cooldownMs = 60_000, now = () => Date.now() }) {
    this.runSyncFn = runSync;
    this.getLastSuccess = getLastSuccess;
    this.cooldownMs = cooldownMs;
    this.now = now;
  }

  get syncedThisProcess() {
    return this.#syncedThisProcess;
  }

  get isRunning() {
    return this.#inFlight !== null;
  }

  /** Run a sync now (or join the one already running). */
  run() {
    if (this.#inFlight) return this.#inFlight;
    this.#inFlight = (async () => {
      try {
        const result = await this.runSyncFn();
        this.#syncedThisProcess = true;
        this.#lastFailureAt = 0;
        this.#lastError = null;
        return result;
      } catch (err) {
        this.#lastFailureAt = this.now();
        this.#lastError = err;
        throw err;
      } finally {
        this.#inFlight = null;
      }
    })();
    return this.#inFlight;
  }

  /** @returns {{ stale: boolean, warning?: string }} - throws only if there is nothing at all to serve */
  async ensureFresh({ force = false } = {}) {
    if (force) {
      await this.run();
      return { stale: false };
    }
    if (this.#syncedThisProcess) return { stale: false };

    if (this.#lastFailureAt && this.now() - this.#lastFailureAt < this.cooldownMs) {
      return this.#staleOrThrow(this.#lastError);
    }
    try {
      await this.run();
      return { stale: false };
    } catch (err) {
      return this.#staleOrThrow(err);
    }
  }

  async #staleOrThrow(err) {
    const last = await this.getLastSuccess();
    if (!last) throw err;
    return {
      stale: true,
      warning: `Live refresh from SAP failed (${err.message}). Showing data synced at ${new Date(
        last.finishedAt
      ).toISOString()}.`,
    };
  }
}
