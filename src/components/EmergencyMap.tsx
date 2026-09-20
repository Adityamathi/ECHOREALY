'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllSOSRecords } from '@/lib/db';
import type { SosPacket } from '@/lib/db';
import { URGENCY_COLORS, URGENCY_LABELS } from '@/lib/types';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707];
const DEFAULT_ZOOM = 12;

const urgencyColors: Record<SosPacket['urgency'], string> = {
  CRITICAL: '#EF4444',
  HIGH: '#F59E0B',
  MODERATE: '#06B6D4',
};

function CustomMarker({ packet, onClick }: { packet: SosPacket; onClick: () => void }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const color = urgencyColors[packet.urgency];
    const icon = L.divIcon({
      className: 'custom-emergency-marker',
      html: `
        <div style="
          width: 32px; height: 32px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid white;
          box-shadow: 0 2px 12px rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          animation: pulse 2s infinite;
        ">
          <span style="font-size: 12px; color: white; font-weight: bold;">!</span>
        </div>
        <style>
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 ${color}80; }
            70% { box-shadow: 0 0 0 16px ${color}00; }
            100% { box-shadow: 0 0 0 0 ${color}00; }
          }
        </style>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    markerRef.current = L.marker([packet.lat, packet.lng], { icon })
      .addTo(map)
      .on('click', onClick);

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
    };
  }, [map, packet, onClick]);

  return null;
}

interface EmergencyMapProps {
  packets: SosPacket[];
  filter: 'all' | 'critical' | 'unassigned' | 'synced';
  onFilterChange: (filter: 'all' | 'critical' | 'unassigned' | 'synced') => void;
  onPacketClick: (packet: SosPacket) => void;
  onSyncPacket: (packet: SosPacket) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function EmergencyMap({
  packets,
  filter,
  onFilterChange,
  onPacketClick,
  onSyncPacket,
  isLoading,
  onRefresh,
}: EmergencyMapProps) {
  const [showAllMarkers, setShowAllMarkers] = useState(true);
  const [mapKey, setMapKey] = useState(0);

  const filteredPackets = packets.filter((packet) => {
    if (filter === 'all') return true;
    if (filter === 'critical') return packet.urgency === 'CRITICAL';
    if (filter === 'unassigned') return !packet.synced;
    if (filter === 'synced') return packet.synced;
    return true;
  });

  const criticalCount = packets.filter((p) => p.urgency === 'CRITICAL').length;
  const highCount = packets.filter((p) => p.urgency === 'HIGH').length;
  const pendingMeshCount = packets.filter((p) => !p.synced).length;
  const syncedCount = packets.filter((p) => p.synced).length;
  const bleRelayedCount = packets.filter((p) => p.viaBleBeacon).length;

  return (
    <div className="flex flex-col gap-4 h-full">
      <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#06B6D4]" />
            <CardTitle className="text-lg">Live Emergency Map</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-slate-700"
              onClick={() => setShowAllMarkers(!showAllMarkers)}
            >
              {showAllMarkers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAllMarkers ? 'Hide' : 'Show'} Markers
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-slate-700"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative min-h-0">
          <MapContainer
            key={mapKey}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            className="w-full h-full rounded-lg"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {showAllMarkers &&
              filteredPackets.map((packet) => (
                <CustomMarker
                  key={packet.id}
                  packet={packet}
                  onClick={() => onPacketClick(packet)}
                />
              ))}
          </MapContainer>

          {filteredPackets.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <MapPin className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-lg">No emergency reports found</p>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-[#EF4444]" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: 'Critical', count: criticalCount, color: 'bg-[#EF4444]', icon: AlertTriangle },
          { label: 'High', count: highCount, color: 'bg-[#F59E0B]', icon: AlertTriangle },
          { label: 'BLE Relayed', count: bleRelayedCount, color: 'bg-[#06B6D4]', icon: CheckCircle },
          { label: 'Pending Mesh', count: pendingMeshCount, color: 'bg-slate-600', icon: XCircle },
          { label: 'Synced', count: syncedCount, color: 'bg-green-500', icon: CheckCircle },
        ].map((stat) => (
          <Card key={stat.label} className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.color}/20 flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.count}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <style jsx>{`
        .custom-emergency-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}