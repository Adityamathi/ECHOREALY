'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import {
  Filter,
  RefreshCw,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Map,
  Layers,
  Download,
  Wifi,
  WifiOff,
  Search,
  ChevronDown,
  Bluetooth,
  Volume2,
  Bell,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { getAllSOSRecords, markAsSynced, clearAllRecords, db } from '@/lib/db';
import type { SosPacket } from '@/lib/db';
import { URGENCY_COLORS, URGENCY_LABELS } from '@/lib/types';
import { useBleMesh } from '@/lib/useBleMesh';

const EmergencyMap = dynamic(() => import('@/components/EmergencyMap').then((mod) => mod.EmergencyMap), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-800">
      <div className="text-slate-500">Loading map...</div>
    </div>
  ),
});

interface ResponderDashboardProps {
  isOnline: boolean;
  onToggleOnline: () => void;
  onSyncNow: () => void;
  pendingCount: number;
  lastSyncAt?: string;
}

export function ResponderDashboard({
  isOnline,
  onToggleOnline,
  onSyncNow,
  pendingCount,
  lastSyncAt,
}: ResponderDashboardProps) {
  const [packets, setPackets] = useState<SosPacket[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'unassigned' | 'synced'>('all');
  const [selectedPacket, setSelectedPacket] = useState<SosPacket | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    isScanning,
    isSupported: bleSupported,
    startScanning,
    stopScanning,
    lastReceivedPacket,
    packetsReceived,
    requestNotificationPermission,
  } = useBleMesh();

  const loadPackets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllSOSRecords();
      setPackets(data);
    } catch (err) {
      console.error('Failed to load packets:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackets();
  }, [loadPackets]);

  useEffect(() => {
    if (lastReceivedPacket) {
      setPackets(prev => {
        if (prev.some(p => p.id === lastReceivedPacket.id)) return prev;
        return [lastReceivedPacket, ...prev];
      });
    }
  }, [lastReceivedPacket]);

  const filteredPackets = packets.filter((packet) => {
    if (filter === 'all') return true;
    if (filter === 'critical') return packet.urgency === 'CRITICAL';
    if (filter === 'unassigned') return !packet.synced;
    if (filter === 'synced') return packet.synced;
    return true;
  });

  const handleMarkerClick = useCallback((packet: SosPacket) => {
    setSelectedPacket(packet);
  }, []);

  const handleSyncPacket = async (packet: SosPacket) => {
    await markAsSynced(packet.id);
    loadPackets();
  };

  const handleClearAll = async () => {
    if (confirm('Clear all emergency records? This cannot be undone.')) {
      await clearAllRecords();
      loadPackets();
    }
  };

  const handleInjectDemo = async () => {
    const demoPackets: SosPacket[] = [
      {
        id: `demo_${Date.now()}_1`,
        timestamp: new Date().toISOString(),
        transcript: '[BLE Beacon] Medical - CRITICAL',
        urgency: 'CRITICAL',
        category: 'Medical',
        lat: 13.0827 + (Math.random() - 0.5) * 0.01,
        lng: 80.2707 + (Math.random() - 0.5) * 0.01,
        synced: false,
        hopCount: 1,
        viaBleBeacon: true,
      },
      {
        id: `demo_${Date.now()}_2`,
        timestamp: new Date().toISOString(),
        transcript: '[BLE Beacon] Extraction - HIGH',
        urgency: 'HIGH',
        category: 'Extraction',
        lat: 13.0827 + (Math.random() - 0.5) * 0.01,
        lng: 80.2707 + (Math.random() - 0.5) * 0.01,
        synced: false,
        hopCount: 2,
        viaBleBeacon: true,
      },
      {
        id: `demo_${Date.now()}_3`,
        timestamp: new Date().toISOString(),
        transcript: '[BLE Beacon] Supplies - MODERATE',
        urgency: 'MODERATE',
        category: 'Supplies',
        lat: 13.0827 + (Math.random() - 0.5) * 0.01,
        lng: 80.2707 + (Math.random() - 0.5) * 0.01,
        synced: false,
        hopCount: 1,
        viaBleBeacon: true,
      },
    ];

    for (const packet of demoPackets) {
      await db.sosPackets.put(packet);
    }
    loadPackets();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 gap-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4 min-h-0">
          <EmergencyMap
            packets={packets}
            filter={filter}
            onFilterChange={setFilter}
            onPacketClick={handleMarkerClick}
            onSyncPacket={handleSyncPacket}
            isLoading={isLoading}
            onRefresh={loadPackets}
          />

          <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                <CardTitle className="text-lg">Triage Queue</CardTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 border-slate-700">
                    <Filter className="w-4 h-4" />
                    Filter
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Filter Reports</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { value: 'all', label: 'All Reports' },
                    { value: 'critical', label: 'Critical Only' },
                    { value: 'unassigned', label: 'Unassigned (Pending Mesh)' },
                    { value: 'synced', label: 'Synced / Dispatched' },
                  ].map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      className={`flex items-center gap-2 ${filter === opt.value ? 'bg-slate-800' : ''}`}
                      onClick={() => setFilter(opt.value as typeof filter)}
                    >
                      {filter === opt.value && <CheckCircle className="w-4 h-4 text-green-400" />}
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-auto">
              {filteredPackets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6">
                  <XCircle className="w-12 h-12 mb-3 opacity-30" />
                  <p>No reports match current filter</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredPackets.map((packet) => (
                    <div
                      key={packet.id}
                      className="p-4 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => handleMarkerClick(packet)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${URGENCY_COLORS[packet.urgency]}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCY_COLORS[packet.urgency]} text-white`}
                            >
                              {URGENCY_LABELS[packet.urgency]}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {new Date(packet.timestamp).toLocaleTimeString()}
                            </span>
                            {packet.viaBleBeacon && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#06B6D4]/20 text-[#06B6D4] flex items-center gap-1">
                                <Bluetooth className="w-3 h-3" />
                                BLE Relay • Hops: {packet.hopCount}
                              </span>
                            )}
                            {!packet.synced && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-600/20 text-slate-400">
                                Pending Mesh
                              </span>
                            )}
                            {packet.synced && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                                Synced
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-2 mb-1">
                            {packet.transcript}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-slate-700">{packet.category}</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {packet.lat.toFixed(4)}, {packet.lng.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        {!packet.synced && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-400 hover:text-green-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncPacket(packet);
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bluetooth className="w-5 h-5 text-[#06B6D4]" />
                Passive BLE Mesh Listener
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Background Scanner</p>
                  <p className="text-xs text-slate-500">
                    Passively captures nearby EchoRelay BLE beacons automatically
                  </p>
                </div>
                <Switch
                  checked={isScanning}
                  onCheckedChange={() => isScanning ? stopScanning() : startScanning()}
                  disabled={!bleSupported}
                  className="data-[state=checked]:bg-[#06B6D4] data-[state=unchecked]:bg-slate-600"
                />
              </div>

              {isScanning && (
                <div className="p-3 bg-[#06B6D4]/10 border border-[#06B6D4]/20 rounded-lg animate-pulse">
                  <div className="flex items-center gap-2 text-[#06B6D4]">
                    <Zap className="w-4 h-4" />
                    <span className="font-medium">ACTIVE LISTENING</span>
                    <span className="text-xs bg-[#06B6D4]/20 px-2 py-0.5 rounded">Packets: {packetsReceived}</span>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">BLE Support</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bleSupported ? 'bg-[#06B6D4]/20 text-[#06B6D4]' : 'bg-slate-700 text-slate-400'}`}>
                    {bleSupported ? 'Available' : 'Unsupported (Simulation Mode)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">Auto-Capture</span>
                  <span className="font-mono font-bold text-[#06B6D4]">{packetsReceived}</span>
                </div>
              </div>

              <Button
                variant={isScanning ? 'destructive' : 'default'}
                className="w-full gap-2"
                onClick={() => isScanning ? stopScanning() : startScanning()}
                disabled={!bleSupported}
              >
                {isScanning ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Stop Passive Listener
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Enable Passive Listener
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={requestNotificationPermission}
              >
                <Bell className="w-4 h-4" />
                Enable Alert Notifications
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wifi className="w-5 h-5 text-cyan-500" />
                Network Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Disaster Offline Mode</p>
                  <p className="text-xs text-slate-500">
                    When enabled, records queue locally. Toggle off to sync to cloud.
                  </p>
                </div>
                <Switch
                  checked={!isOnline}
                  onCheckedChange={onToggleOnline}
                  className="data-[state=checked]:bg-[#EF4444] data-[state=unchecked]:bg-[#06B6D4]"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">Cloud Status</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isOnline
                        ? 'bg-[#06B6D4]/20 text-[#06B6D4]'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {isOnline ? 'Connected to Supabase' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">Pending Sync</span>
                  <span className="font-mono font-bold text-[#F59E0B]">{pendingCount}</span>
                </div>
                {lastSyncAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Last Sync</span>
                    <span className="text-slate-400 font-mono">
                      {new Date(lastSyncAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>

              <Button
                className="w-full gap-2"
                onClick={onSyncNow}
                disabled={!isOnline || pendingCount === 0}
                variant={isOnline ? 'default' : 'outline'}
              >
                <Download className="w-4 h-4" />
                Sync Now to Supabase & Run AI Triage
              </Button>

              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={handleClearAll}
              >
                <XCircle className="w-4 h-4" />
                Clear All Records
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F59E0B]" />
                Demo Injector
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-400">
                Inject simulated BLE disaster beacons for live demo
              </p>
              <Button
                variant="default"
                className="w-full gap-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black"
                onClick={handleInjectDemo}
              >
                <Zap className="w-4 h-4" />
                Inject Demo BLE Disaster Beacons
              </Button>
            </CardContent>
          </Card>

          {selectedPacket && (
            <Card className="bg-slate-900/50 border-slate-800 animate-slide-in">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Report Details</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPacket(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full ${URGENCY_COLORS[selectedPacket.urgency]}`}
                  />
                  <span className="font-semibold text-white">
                    {URGENCY_LABELS[selectedPacket.urgency]} Priority
                  </span>
                  {selectedPacket.viaBleBeacon && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#06B6D4]/20 text-[#06B6D4] flex items-center gap-1">
                      <Bluetooth className="w-3 h-3" />
                      BLE Relay
                    </span>
                  )}
                </div>
                <p className="text-slate-300">{selectedPacket.transcript}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-sm">{selectedPacket.category}</span>
                  <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-sm">Hops: {selectedPacket.hopCount}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-500">Location</p>
                    <p className="font-mono text-white">{selectedPacket.lat.toFixed(6)}, {selectedPacket.lng.toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Reported</p>
                    <p className="font-mono text-white">{new Date(selectedPacket.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="font-mono text-white capitalize">{selectedPacket.synced ? 'Synced' : 'Pending Mesh'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">ID</p>
                    <p className="font-mono text-white text-xs truncate max-w-[120px]">{selectedPacket.id}</p>
                  </div>
                </div>
                {!selectedPacket.synced && (
                  <Button className="w-full gap-2" onClick={() => handleSyncPacket(selectedPacket)}>
                    <CheckCircle className="w-4 h-4" />
                    Mark as Synced
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}