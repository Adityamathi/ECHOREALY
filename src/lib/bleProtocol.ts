import type { SosPacket } from '@/lib/db';

const MAGIC_BYTE_0 = 0x45; // 'E'
const MAGIC_BYTE_1 = 0x52; // 'R'

export const UrgencyCode = {
  CRITICAL: 1,
  HIGH: 2,
  MODERATE: 3,
} as const;

export const CategoryCode = {
  Medical: 1,
  Extraction: 2,
  Supplies: 3,
  General: 4,
} as const;

export const UrgencyCodeToLabel: Record<number, 'CRITICAL' | 'HIGH' | 'MODERATE'> = {
  1: 'CRITICAL',
  2: 'HIGH',
  3: 'MODERATE',
};

export const CategoryCodeToLabel: Record<number, 'Medical' | 'Extraction' | 'Supplies' | 'General'> = {
  1: 'Medical',
  2: 'Extraction',
  3: 'Supplies',
  4: 'General',
};

function generatePacketId(): number {
  return Math.floor(Math.random() * 65535);
}

export function encodeSosToBuffer(packet: Partial<SosPacket>): ArrayBuffer {
  const buffer = new ArrayBuffer(14);
  const view = new DataView(buffer);

  view.setUint8(0, MAGIC_BYTE_0);
  view.setUint8(1, MAGIC_BYTE_1);

  const packetId = packet.id ? parseInt(packet.id.replace(/\D/g, '').slice(-5)) || generatePacketId() : generatePacketId();
  view.setUint16(2, packetId, false);

  const urgency = packet.urgency ? UrgencyCode[packet.urgency] : UrgencyCode.MODERATE;
  view.setUint8(4, urgency);

  const category = packet.category ? CategoryCode[packet.category] : CategoryCode.General;
  view.setUint8(5, category);

  const lat = packet.lat ?? 13.0827;
  const lng = packet.lng ?? 80.2707;
  view.setFloat32(6, lat, false);
  view.setFloat32(10, lng, false);

  return buffer;
}

export function decodeBufferToSos(buffer: ArrayBuffer): Partial<SosPacket> | null {
  if (buffer.byteLength < 14) return null;

  const view = new DataView(buffer);

  if (view.getUint8(0) !== MAGIC_BYTE_0 || view.getUint8(1) !== MAGIC_BYTE_1) {
    return null;
  }

  const packetId = view.getUint16(2, false);
  const urgencyCode = view.getUint8(4);
  const categoryCode = view.getUint8(5);
  const lat = view.getFloat32(6, false);
  const lng = view.getFloat32(10, false);

  const urgency = UrgencyCodeToLabel[urgencyCode] || 'MODERATE';
  const category = CategoryCodeToLabel[categoryCode] || 'General';

  return {
    id: `ble_${packetId}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    transcript: `[BLE Beacon] ${category} - ${urgency}`,
    urgency,
    category,
    lat,
    lng,
    synced: false,
    hopCount: 0,
    viaBleBeacon: true,
  };
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = hex.split(' ').map(b => parseInt(b, 16));
  return new Uint8Array(bytes).buffer;
}