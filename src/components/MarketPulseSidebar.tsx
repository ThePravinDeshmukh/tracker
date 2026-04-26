import React from 'react';
import { MomentumRow, StressEvent } from '../types';
import PulseTable from './PulseTable';
import StressFeed from './StressFeed';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rows: MomentumRow[];
  stressEvents: StressEvent[];
}

export default function MarketPulseSidebar({
  isOpen,
  onClose,
  rows,
  stressEvents,
}: Props) {
  return (
    <>
      {isOpen && <div className="watcher-overlay" onClick={onClose} />}
      <div className={`watcher-sidebar pulse-sidebar${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div className="watcher-header">
          <span className="watcher-title">
            <span className="pulse-sidebar-icon">⚡</span>
            Market Pulse
          </span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="watcher-body">
          {/* Pulse Table */}
          <div className="watcher-section">
            <div className="watcher-section-label">Pulse Table</div>
            <PulseTable rows={rows} />
          </div>

          {/* Stress Feed */}
          <div className="watcher-section">
            <div className="watcher-section-label">
              Stress Feed
              {stressEvents.length > 0 && (
                <span className="momentum-badge momentum-badge--sm">{stressEvents.length}</span>
              )}
            </div>
            <StressFeed events={stressEvents} />
          </div>

        </div>
      </div>
    </>
  );
}
