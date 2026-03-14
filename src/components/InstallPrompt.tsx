import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed — don't show
    if (isInStandaloneMode()) return;

    if (isIOS()) {
      setShowIOSHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async (): Promise<void> => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstallEvent(null);
  };

  const handleDismiss = (): void => {
    setInstallEvent(null);
    setShowIOSHint(false);
    setDismissed(true);
  };

  if (dismissed) return null;

  // Android / Desktop Chrome — native install prompt
  if (installEvent) {
    return (
      <div className="install-banner fade-in">
        <div className="install-banner-content">
          <span className="install-icon">◈</span>
          <div>
            <div className="install-title">Install App</div>
            <div className="install-sub">Add to home screen for quick access</div>
          </div>
        </div>
        <div className="install-actions">
          <button className="btn secondary small" onClick={handleDismiss}>Not now</button>
          <button className="btn primary small" onClick={handleInstall}>Install</button>
        </div>
      </div>
    );
  }

  // iOS — manual instructions
  if (showIOSHint) {
    return (
      <div className="install-banner fade-in">
        <div className="install-banner-content">
          <span className="install-icon">◈</span>
          <div>
            <div className="install-title">Install on iPhone / iPad</div>
            <div className="install-sub">
              Tap <strong>Share</strong> <span className="share-icon">⎋</span> then <strong>Add to Home Screen</strong>
            </div>
          </div>
        </div>
        <div className="install-actions">
          <button className="btn secondary small" onClick={handleDismiss}>Dismiss</button>
        </div>
      </div>
    );
  }

  return null;
}
