'use client';

import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { VictimView } from '@/components/VictimView';
import { ResponderDashboard } from '@/components/ResponderDashboard';
import { SWRegister } from '@/components/SWRegister';
import { getPendingRecords, saveSOSRecord } from '@/lib/db';
import type { SosPacket } from '@/lib/db';

type ViewMode = 'victim' | 'responder';

export function EchoRelayClient() {
  const [currentView, setCurrentView] = useState<ViewMode>('victim');
  const [isOnline, setIsOnline] = useState(true);
  const [peersConnected, setPeersConnected] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>();

  const updatePendingCount = useCallback(async () => {
    const records = await getPendingRecords();
    setPendingCount(records.length);
  }, []);

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  const handleRecordSaved = useCallback(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  const handleToggleOnline = useCallback(() => {
    setIsOnline(prev => !prev);
  }, []);

  const handleSyncNow = useCallback(async () => {
    const records = await getPendingRecords();
    for (const record of records) {
      await saveSOSRecord({ ...record, synced: true });
    }
    setLastSyncAt(new Date().toISOString());
    updatePendingCount();
  }, [updatePendingCount]);

  return (
    <div className="min-h-screen bg-[#090D16] text-white flex flex-col">
      <SWRegister />
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        isOnline={isOnline}
        onToggleOnline={handleToggleOnline}
        bleAdvertising={false}
        bleScanning={false}
        peersConnected={peersConnected}
        pendingCount={pendingCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'victim' ? (
          <VictimView />
        ) : (
          <ResponderDashboard
            isOnline={isOnline}
            onToggleOnline={handleToggleOnline}
            onSyncNow={handleSyncNow}
            pendingCount={pendingCount}
            lastSyncAt={lastSyncAt}
          />
        )}
      </main>
    </div>
  );
}