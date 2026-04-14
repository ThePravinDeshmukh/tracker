import { useState, useEffect, useCallback } from 'react';
import { NetworkEntry, FetchEntry, WebSocketEntry } from '../types';

const MAX_ENTRIES = 200;

// Module-level state shared across all hook instances (there should be only one).
// Using a module-level subscriber pattern avoids React context for this
// cross-cutting concern while keeping state updates driven by React setState.
let moduleEntries: NetworkEntry[] = [];
const listeners = new Set<React.Dispatch<React.SetStateAction<NetworkEntry[]>>>();

// Sentinel to prevent double-patching (e.g. React 18 StrictMode double-invoke)
let fetchPatched = false;
let wsPatched = false;

function notify(): void {
  const snapshot = [...moduleEntries];
  listeners.forEach(set => set(snapshot));
}

function addEntry(entry: NetworkEntry): void {
  moduleEntries = [entry, ...moduleEntries].slice(0, MAX_ENTRIES);
  notify();
}

function updateEntry(id: string, patch: Partial<NetworkEntry>): void {
  moduleEntries = moduleEntries.map(e =>
    e.id === id ? ({ ...e, ...patch } as NetworkEntry) : e
  );
  notify();
}

// ── fetch wrapper ─────────────────────────────────────────────────────────────

function patchFetch(): void {
  if (fetchPatched) return;
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const id = crypto.randomUUID();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const startedAt = Date.now();

    const entry: FetchEntry = {
      id,
      method: 'GET',
      url,
      startedAt,
      durationMs: null,
      status: 0 as number,
    };
    addEntry(entry);

    return originalFetch(input, init).then(
      (response: Response) => {
        updateEntry(id, {
          status: response.status,
          durationMs: Date.now() - startedAt,
        } as Partial<FetchEntry>);
        return response;
      },
      (err: unknown) => {
        updateEntry(id, {
          status: 'ERR',
          durationMs: Date.now() - startedAt,
        } as Partial<FetchEntry>);
        throw err;
      }
    );
  };
}

// ── WebSocket wrapper ─────────────────────────────────────────────────────────

function patchWebSocket(): void {
  if (wsPatched) return;
  wsPatched = true;

  const OriginalWebSocket = window.WebSocket;

  // Extend the real WebSocket so instanceof checks and readyState/send/close
  // all work transparently. Private fields track the log entry for this socket.
  class PatchedWebSocket extends OriginalWebSocket {
    private readonly _ncId: string;
    private readonly _ncStart: number;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);

      this._ncId = crypto.randomUUID();
      this._ncStart = Date.now();

      const fullUrl = url instanceof URL ? url.href : url;

      const entry: WebSocketEntry = {
        id: this._ncId,
        method: 'WS',
        url: fullUrl,
        startedAt: this._ncStart,
        durationMs: null,
        status: 'CONNECTING',
      };
      addEntry(entry);

      this.addEventListener('open', () => {
        updateEntry(this._ncId, { status: 'LIVE' } as Partial<WebSocketEntry>);
      });

      this.addEventListener('error', () => {
        updateEntry(this._ncId, {
          status: 'ERR',
          durationMs: Date.now() - this._ncStart,
        } as Partial<WebSocketEntry>);
      });

      this.addEventListener('close', () => {
        updateEntry(this._ncId, {
          status: 'CLOSED',
          durationMs: Date.now() - this._ncStart,
        } as Partial<WebSocketEntry>);
      });
    }
  }

  window.WebSocket = PatchedWebSocket as unknown as typeof WebSocket;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseNetworkLogResult {
  entries: NetworkEntry[];
  clearEntries: () => void;
}

export function useNetworkLog(): UseNetworkLogResult {
  const [entries, setEntries] = useState<NetworkEntry[]>([...moduleEntries]);

  const clearEntries = useCallback(() => {
    moduleEntries = [];
    notify();
  }, []);

  useEffect(() => {
    listeners.add(setEntries);
    patchFetch();
    patchWebSocket();
    return () => { listeners.delete(setEntries); };
  }, []);

  return { entries, clearEntries };
}
