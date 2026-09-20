'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { db, type SosPacket } from '@/lib/db';
import { decodeBufferToSos, bufferToHex } from '@/lib/bleProtocol';

interface BleState {
  isAdvertising: boolean;
  isScanning: boolean;
  isSupported: boolean;
  lastReceivedPacket: SosPacket | null;
  packetsReceived: number;
  error: string | null;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth: any;
}

export function useBleMesh() {
  const [state, setState] = useState<BleState>({
    isAdvertising: false,
    isScanning: false,
    isSupported: false,
    lastReceivedPacket: null,
    packetsReceived: 0,
    error: null,
  });

  const advertisingIntervalRef = useRef<any>(null);
  const scanControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processedPacketIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'bluetooth' in navigator) {
      setState(prev => ({ ...prev, isSupported: true }));
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    }
  }, []);

  const playAlertSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const startAdvertising = useCallback((buffer: ArrayBuffer) => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Web Bluetooth not supported' }));
      return;
    }

    const hexData = bufferToHex(buffer);
    console.log('📡 Simulating BLE Advertising:', hexData);

    setState(prev => ({ ...prev, isAdvertising: true, error: null }));

    advertisingIntervalRef.current = window.setInterval(() => {
      console.log('📡 [BLE Advertising] Broadcasting:', hexData);
    }, 2000);
  }, [state.isSupported]);

  const stopAdvertising = useCallback(() => {
    if (advertisingIntervalRef.current) {
      clearInterval(advertisingIntervalRef.current);
      advertisingIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, isAdvertising: false }));
  }, []);

  const startScanning = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Web Bluetooth not supported' }));
      return;
    }

    try {
      scanControllerRef.current = new AbortController();

      const nav = navigator as NavigatorWithBluetooth;
      await nav.bluetooth.requestLEScan({
        filters: [],
        keepRepeatedDevices: true,
      });

      nav.bluetooth.addEventListener('advertisementreceived', handleAdvertisement);

      setState(prev => ({ ...prev, isScanning: true, error: null }));
      console.log('📡 Passive BLE Listener started');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.log('📡 [SIMULATION MODE] Web Bluetooth permission denied - using simulation');
        startSimulationMode();
      } else {
        setState(prev => ({ ...prev, error: err.message || 'Failed to start scanning' }));
      }
    }
  }, [state.isSupported]);

  const startSimulationMode = useCallback(() => {
    setState(prev => ({ ...prev, isScanning: true, error: null }));

    const simulateIncoming = () => {
      const testPackets: Partial<SosPacket>[] = [
        { urgency: 'CRITICAL', category: 'Medical', lat: 13.0827, lng: 80.2707 },
        { urgency: 'HIGH', category: 'Extraction', lat: 13.0850, lng: 80.2720 },
        { urgency: 'MODERATE', category: 'Supplies', lat: 13.0800, lng: 80.2680 },
      ];

      const randomPacket = testPackets[Math.floor(Math.random() * testPackets.length)];
      const buffer = new ArrayBuffer(14);
      const view = new DataView(buffer);
      view.setUint8(0, 0x45);
      view.setUint8(1, 0x52);
      view.setUint16(2, Math.floor(Math.random() * 65535), false);
      view.setUint8(4, randomPacket.urgency === 'CRITICAL' ? 1 : randomPacket.urgency === 'HIGH' ? 2 : 3);
      view.setUint8(5, randomPacket.category === 'Medical' ? 1 : randomPacket.category === 'Extraction' ? 2 : 3);
      view.setFloat32(6, randomPacket.lat!, false);
      view.setFloat32(10, randomPacket.lng!, false);

      handleAdvertisement({ manufacturerData: new Map([[0x0545, new DataView(buffer)]]) } as any);
    };

    simulateIncoming();
    const interval = setInterval(simulateIncoming, 15000 + Math.random() * 15000);
    advertisingIntervalRef.current = interval;
  }, []);

  const handleAdvertisement = useCallback(async (event: any) => {
    const manufacturerData = event.manufacturerData;
    if (!manufacturerData) return;

    for (const [companyId, dataView] of manufacturerData) {
      if (companyId === 0x0545 || dataView.byteLength >= 14) {
        const buffer = dataView.buffer.slice(dataView.byteOffset, dataView.byteOffset + dataView.byteLength) as ArrayBuffer;
        const packet = decodeBufferToSos(buffer);

        if (packet && packet.id && !processedPacketIdsRef.current.has(packet.id)) {
          processedPacketIdsRef.current.add(packet.id);

          const packetWithHop: SosPacket = {
            ...packet,
            hopCount: (packet.hopCount || 0) + 1,
          } as SosPacket;

          await db.sosPackets.put(packetWithHop);

          playAlertSound();

          setState(prev => ({
            ...prev,
            lastReceivedPacket: packetWithHop,
            packetsReceived: prev.packetsReceived + 1,
          }));

          console.log('🚨 Passive BLE SOS Captured!', packetWithHop);

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🚨 Passive BLE SOS Captured!', {
              body: `${packetWithHop.urgency} ${packetWithHop.category} at ${packetWithHop.lat.toFixed(4)}, ${packetWithHop.lng.toFixed(4)}`,
              icon: '/icon-192.png',
            });
          }
        }
      }
    }
  }, [playAlertSound]);

  const stopScanning = useCallback(() => {
    if (advertisingIntervalRef.current) {
      clearInterval(advertisingIntervalRef.current);
      advertisingIntervalRef.current = null;
    }

    if (scanControllerRef.current) {
      scanControllerRef.current.abort();
    }

    try {
      const nav = navigator as NavigatorWithBluetooth;
      nav.bluetooth.removeEventListener('advertisementreceived', handleAdvertisement);
    } catch {}

    setState(prev => ({ ...prev, isScanning: false }));
  }, [handleAdvertisement]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
  }, []);

  return {
    ...state,
    startAdvertising,
    stopAdvertising,
    startScanning,
    stopScanning,
    requestNotificationPermission,
  };
}