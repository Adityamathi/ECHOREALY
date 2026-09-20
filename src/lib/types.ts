export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
export type AidCategory = 'Medical' | 'Water' | 'Food' | 'Extraction' | 'Shelter' | 'Other';

export interface SOSRecord {
  id: string;
  timestamp: string;
  transcript: string;
  urgency: UrgencyLevel;
  category: AidCategory[];
  latitude: number;
  longitude: number;
  locationName?: string;
  status: 'pending_mesh' | 'synced' | 'dispatched' | 'resolved';
  audioBlob?: Blob;
  syncedAt?: string;
}

export interface MeshPeer {
  id: string;
  name: string;
  connectedAt: string;
  lastSeen: string;
}

export interface SyncStatus {
  isOnline: boolean;
  peersConnected: number;
  pendingCount: number;
  lastSyncAt?: string;
}

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  CRITICAL: 'bg-[#EF4444]',
  HIGH: 'bg-[#F59E0B]',
  MODERATE: 'bg-[#06B6D4]',
  LOW: 'bg-green-500',
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
};