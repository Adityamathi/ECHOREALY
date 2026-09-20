import Dexie, { Table } from 'dexie';

export interface SosPacket {
  id: string;
  timestamp: string;
  transcript: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MODERATE';
  category: 'Medical' | 'Extraction' | 'Supplies' | 'General';
  lat: number;
  lng: number;
  synced: boolean;
  hopCount: number;
  viaBleBeacon: boolean;
}

class EchoRelayDB extends Dexie {
  sosPackets!: Table<SosPacket>;

  constructor() {
    super('EchoRelayDB');
    this.version(1).stores({
      sosPackets: 'id, timestamp, urgency, category, synced, viaBleBeacon'
    });
  }
}

export const db = new EchoRelayDB();

let dbInstance: EchoRelayDB | null = null;

function getDB(): EchoRelayDB | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!dbInstance) {
    dbInstance = new EchoRelayDB();
  }
  return dbInstance;
}

async function withDB<T>(fn: (db: EchoRelayDB) => Promise<T>): Promise<T | null> {
  const db = getDB();
  if (!db) return null;
  return fn(db);
}

export async function saveSOSRecord(record: SosPacket): Promise<void> {
  await withDB((db) => db.sosPackets.put(record));
}

export async function getAllSOSRecords(): Promise<SosPacket[]> {
  const result = await withDB((db) => db.sosPackets.orderBy('timestamp').reverse().toArray());
  return result ?? [];
}

export async function getPendingRecords(): Promise<SosPacket[]> {
  const result = await withDB((db) => db.sosPackets.where('synced').equals(0).toArray());
  return result ?? [];
}

export async function markAsSynced(id: string): Promise<void> {
  await withDB((db) => db.sosPackets.update(id, { synced: true }));
}

export async function clearAllRecords(): Promise<void> {
  await withDB((db) => db.sosPackets.clear());
}