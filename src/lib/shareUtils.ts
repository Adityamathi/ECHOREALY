'use client';

import type { SosPacket } from '@/lib/db';

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(b64url: string): string {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return decodeURIComponent(escape(atob(b64)));
}

export interface CompactSos {
  i: string;
  t: string;
  tr: string;
  u: SosPacket['urgency'];
  c: SosPacket['category'];
  lat: number;
  lng: number;
}

export function encodePacketForUrl(packet: SosPacket): string {
  const compact: CompactSos = {
    i: packet.id,
    t: packet.timestamp,
    tr: packet.transcript.slice(0, 280),
    u: packet.urgency,
    c: packet.category,
    lat: packet.lat,
    lng: packet.lng,
  };
  return base64UrlEncode(JSON.stringify(compact));
}

export function decodePacketFromUrl(d: string): CompactSos | null {
  try {
    return JSON.parse(base64UrlDecode(d)) as CompactSos;
  } catch {
    return null;
  }
}

export function buildSosUrl(packet: SosPacket): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/sos?d=${encodePacketForUrl(packet)}`;
}

export function buildSosUrlOnHost(packet: SosPacket, host: string): string {
  return `http://${host}/sos?d=${encodePacketForUrl(packet)}`;
}

export function isLocalhostHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export async function getLocalIPsViaWebRTC(): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      const ips = new Set<string>();
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('x');
      pc.onicecandidate = (e: any) => {
        if (e.candidate) {
          const m = /([0-9]{1,3}\.){3}[0-9]{1,3}/.exec(e.candidate.candidate);
          if (m && m[0] !== '127.0.0.1' && !m[0].startsWith('0.')) ips.add(m[0]);
        } else {
          try { pc.close(); } catch {}
          resolve([...ips].filter((ip) => ip !== '127.0.0.1'));
        }
      };
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .catch(() => resolve([]));
      setTimeout(() => {
        try { pc.close(); } catch {}
        resolve([...ips].filter((ip) => ip !== '127.0.0.1'));
      }, 4000);
    } catch {
      resolve([]);
    }
  });
}

export function buildSosMessage(packet: SosPacket, url: string): string {
  return (
    `🚨 EchoRelay EMERGENCY SOS — ${packet.urgency}\n` +
    `${packet.transcript}\n` +
    `Category: ${packet.category}\n` +
    `Location: ${packet.lat.toFixed(5)}, ${packet.lng.toFixed(5)}\n` +
    `Time: ${new Date(packet.timestamp).toLocaleString()}\n` +
    `Open alert: ${url}`
  );
}

export async function shareViaSystem(packet: SosPacket, url: string): Promise<'shared' | 'unsupported' | 'cancelled' | 'failed'> {
  const message = buildSosMessage(packet, url);
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as any).share({
        title: `🚨 SOS — ${packet.urgency} ${packet.category}`,
        text: message,
        url,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }
  return 'unsupported';
}

export async function shareViaBluetooth(packet: SosPacket, url: string): Promise<'shared' | 'unsupported' | 'cancelled' | 'failed'> {
  const message = buildSosMessage(packet, url);
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (!nav || typeof nav.share !== 'function') return 'unsupported';
  try {
    await nav.share({
      title: `🚨 SOS — ${packet.urgency} ${packet.category}`,
      text: message,
      url,
    });
    return 'shared';
  } catch (err: any) {
    if (err?.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
