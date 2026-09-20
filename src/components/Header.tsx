'use client';

import { RadioTower, Wifi, WifiOff, AlertTriangle, LayoutDashboard, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'victim' | 'responder';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  bleAdvertising: boolean;
  bleScanning: boolean;
  peersConnected: number;
  pendingCount: number;
}

export function Header({
  currentView,
  onViewChange,
  isOnline,
  onToggleOnline,
  bleAdvertising,
  bleScanning,
  peersConnected,
  pendingCount,
}: HeaderProps) {
  return (
    <header className="w-full border-b border-slate-800 bg-[#090D16]/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#EF4444] to-[#F59E0B]">
              <RadioTower className="w-6 h-6 text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#06B6D4] animate-ping opacity-75" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">EchoRelay</h1>
              <p className="text-xs text-slate-400">Autonomous Offline BLE Mesh</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 bg-slate-900/50 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => onViewChange('victim')}
              className={cn(
                'gap-2 px-4 py-2 text-sm rounded-md transition-all',
                currentView === 'victim'
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Mic className="w-4 h-4" />
              SOS Node
            </button>
            <button
              onClick={() => onViewChange('responder')}
              className={cn(
                'gap-2 px-4 py-2 text-sm rounded-md transition-all',
                currentView === 'responder'
                  ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Command Center
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onToggleOnline}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                isOnline
                  ? 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/30'
                  : 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30'
              )}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {isOnline ? 'Online Cloud Link' : 'Disaster Offline Mesh'}
            </button>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-slate-400">
                <RadioTower className="w-3 h-3" />
                <span>{peersConnected}</span>
              </div>
              <div className="flex items-center gap-1 text-[#F59E0B]">
                <AlertTriangle className="w-3 h-3" />
                <span>{pendingCount}</span>
              </div>
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                bleAdvertising ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-slate-800 text-slate-500'
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {bleAdvertising ? 'BLE TX' : 'BLE Idle'}
              </div>
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                bleScanning ? 'bg-[#06B6D4]/20 text-[#06B6D4]' : 'bg-slate-800 text-slate-500'
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {bleScanning ? 'BLE RX' : 'BLE Idle'}
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden mt-3 flex items-center gap-2">
          <button
            onClick={() => onViewChange('victim')}
            className={cn(
              'flex-1 gap-2 px-3 py-2 rounded-lg text-sm',
              currentView === 'victim'
                ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            )}
          >
            <Mic className="w-4 h-4" />
            SOS Node
          </button>
          <button
            onClick={() => onViewChange('responder')}
            className={cn(
              'flex-1 gap-2 px-3 py-2 rounded-lg text-sm',
              currentView === 'responder'
                ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Command Center
          </button>
        </div>
      </div>
    </header>
  );
}