import React, { useState } from 'react';
import { MomentumRow, StressEvent, CorrelationResult } from '../types';
import PulseTable from './PulseTable';
import StressFeed from './StressFeed';
import CorrelationCard from './CorrelationCard';

interface Props {
  rows: MomentumRow[];
  stressEvents: StressEvent[];
  computeCorrelations: (base: string) => CorrelationResult[];
  symbols: string[];
}

export default function MomentumPanel({ rows, stressEvents, computeCorrelations, symbols }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="momentum-panel">
      <div className="momentum-panel-header" onClick={() => setIsOpen(o => !o)}>
        <div className="momentum-panel-title">
          <span className="momentum-panel-icon">⚡</span>
          <span>Market Pulse</span>
          {stressEvents.length > 0 && (
            <span className="momentum-badge">{stressEvents.length}</span>
          )}
        </div>
        <button className="momentum-toggle-btn" aria-label={isOpen ? 'Collapse' : 'Expand'}>
          {isOpen ? '▲' : '▼'}
        </button>
      </div>

      {isOpen && (
        <div className="momentum-panel-body">
          {/* Pulse Table — full width */}
          <div className="momentum-section">
            <div className="momentum-section-label">Pulse Table</div>
            <PulseTable rows={rows} />
          </div>

          {/* Stress Feed + Correlation side by side */}
          <div className="momentum-bottom-row">
            <div className="momentum-section momentum-section--stress">
              <div className="momentum-section-label">
                Stress Feed
                {stressEvents.length > 0 && (
                  <span className="momentum-badge momentum-badge--sm">{stressEvents.length}</span>
                )}
              </div>
              <StressFeed events={stressEvents} />
            </div>

            <div className="momentum-section momentum-section--corr">
              <div className="momentum-section-label">Correlation</div>
              <CorrelationCard
                symbols={symbols}
                momentumRows={rows}
                computeCorrelations={computeCorrelations}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
