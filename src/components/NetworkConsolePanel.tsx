import React, { useState } from 'react';
import { NetworkEntry } from '../types';

interface Props {
  entries: NetworkEntry[];
  onClear: () => void;
}

function getStatusClass(entry: NetworkEntry): string {
  if (entry.method === 'WS') {
    if (entry.status === 'LIVE' || entry.status === 'CONNECTING') return 'nc-status--ws';
    if (entry.status === 'CLOSED') return 'nc-status--closed';
    return 'nc-status--error';
  }
  const code = entry.status as number;
  if (code === 0) return 'nc-status--pending';
  if (code >= 200 && code < 300) return 'nc-status--ok';
  return 'nc-status--error';
}

function formatStatus(entry: NetworkEntry): string {
  if (entry.method === 'WS') return entry.status;
  const code = entry.status as number;
  if (code === 0) return '…';
  return String(code);
}

function formatDuration(entry: NetworkEntry): string {
  if (entry.method === 'WS') {
    if (entry.status === 'LIVE' || entry.status === 'CONNECTING') return 'live';
  }
  if (entry.durationMs === null) return '—';
  if (entry.durationMs < 1000) return `${entry.durationMs}ms`;
  return `${(entry.durationMs / 1000).toFixed(1)}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function NetworkConsolePanel({ entries, onClear }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`nc-panel${isOpen ? ' nc-panel--open' : ''}`}>
      <div className="nc-toolbar">
        <button
          className="nc-toggle-btn"
          onClick={() => setIsOpen(v => !v)}
          title={isOpen ? 'Collapse network panel' : 'Expand network panel'}
        >
          <span className="nc-toggle-icon">{isOpen ? '▼' : '▲'}</span>
          Network
          {entries.length > 0 && (
            <span className="nc-badge">{entries.length}</span>
          )}
        </button>
        {isOpen && (
          <>
            <span className="nc-entry-count">{entries.length} request{entries.length !== 1 ? 's' : ''}</span>
            <button className="nc-clear-btn" onClick={onClear}>Clear</button>
          </>
        )}
      </div>

      {isOpen && (
        <div className="nc-list">
          {entries.length === 0 ? (
            <div className="nc-empty">No network activity captured yet.</div>
          ) : (
            <div className="nc-table">
              <div className="nc-table-header">
                <span>Method</span>
                <span>URL</span>
                <span>Status</span>
                <span>Duration</span>
                <span>Time</span>
              </div>
              {entries.map(entry => (
                <div key={entry.id} className="nc-row">
                  <span className={`nc-method nc-method--${entry.method.toLowerCase()}`}>
                    {entry.method}
                  </span>
                  <span className="nc-url" title={entry.url}>
                    {entry.url}
                  </span>
                  <span className={`nc-status ${getStatusClass(entry)}`}>
                    {formatStatus(entry)}
                  </span>
                  <span className="nc-duration">{formatDuration(entry)}</span>
                  <span className="nc-time">{formatTime(entry.startedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
