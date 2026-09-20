'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, MapPin, Clock, Tag, Volume2, Bell } from 'lucide-react';
import { decodePacketFromUrl } from '@/lib/shareUtils';

function SosAlertContent() {
  const params = useSearchParams();
  const d = params.get('d');
  const packet = useMemo(() => (d ? decodePacketFromUrl(d) : null), [d]);
  const [soundOn, setSoundOn] = useState(false);
  const [notifPerm, setNotifPerm] = useState<string | null>(null);

  useEffect(() => {
    if (!packet) return;
    if ('vibrate' in navigator) {
      try {
        (navigator as any).vibrate([300, 100, 300, 100, 500]);
      } catch {}
    }
    try {
      if ('Notification' in window) {
        setNotifPerm(Notification.permission);
        if (Notification.permission === 'granted') {
          new Notification(`🚨 SOS — ${packet.u} ${packet.c}`, {
            body: packet.tr.slice(0, 120),
            icon: '/icon-192.png',
            tag: packet.i,
            requireInteraction: true,
          } as any);
        }
      }
    } catch {}
  }, [packet]);

  const enableNotifications = async () => {
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
      if (p === 'granted' && packet) {
        new Notification(`🚨 SOS — ${packet.u} ${packet.c}`, {
          body: packet.tr.slice(0, 120),
          icon: '/icon-192.png',
          tag: packet.i,
          requireInteraction: true,
        } as any);
      }
    } catch {}
  };

  useEffect(() => {
    if (!soundOn) return;
    let stopped = false;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => {
        if (stopped) return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 660;
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 400);
    };
    beep();
    const interval = setInterval(beep, 2000);
    return () => {
      stopped = true;
      clearInterval(interval);
      ctx.close();
    };
  }, [soundOn]);

  if (!packet) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <h1 className="text-xl font-bold mb-2">No SOS data found</h1>
          <p className="text-slate-400 text-sm">
            Open this page via a shared EchoRelay SOS link or QR code. The alert data is embedded in the URL.
          </p>
        </div>
      </div>
    );
  }

  const color =
    packet.u === 'CRITICAL' ? '#EF4444' : packet.u === 'HIGH' ? '#F59E0B' : '#06B6D4';

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: '#090D16' }}>
      <div className="p-4 flex items-center justify-center gap-2 animate-pulse" style={{ background: color }}>
        <AlertTriangle className="w-6 h-6 text-white" />
        <span className="font-black text-xl tracking-wide text-white">EMERGENCY SOS — {packet.u}</span>
        <AlertTriangle className="w-6 h-6 text-white" />
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto p-6 flex flex-col gap-4">
        <div className="rounded-2xl border p-5" style={{ borderColor: color, background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-lg leading-relaxed text-white">{packet.tr}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500 flex items-center gap-1"><Tag className="w-3 h-3" /> Category</p>
            <p className="font-bold text-white">{packet.c}</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <p className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Time</p>
            <p className="font-mono text-white text-xs">{new Date(packet.t).toLocaleString()}</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 col-span-2">
            <p className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</p>
            <p className="font-mono text-white">{packet.lat.toFixed(5)}, {packet.lng.toFixed(5)}</p>
            <a
              className="text-sm underline mt-1 inline-block"
              style={{ color }}
              href={`https://www.google.com/maps?q=${packet.lat},${packet.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
        </div>

        <button
          onClick={() => setSoundOn(!soundOn)}
          className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white"
          style={{ background: soundOn ? '#334155' : color }}
        >
          <Volume2 className="w-5 h-5" />
          {soundOn ? 'Stop Alert Siren' : 'Play Alert Siren'}
        </button>

        {notifPerm !== 'granted' && (
          <button
            onClick={enableNotifications}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-white"
          >
            <Bell className="w-5 h-5" />
            Enable SOS Notifications
          </button>
        )}

        <p className="text-center text-xs text-slate-500">
          Received via EchoRelay offline mesh • If you can help, go to the location or call emergency services
        </p>
      </div>
    </div>
  );
}

export default function SosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center">Loading SOS…</div>}>
      <SosAlertContent />
    </Suspense>
  );
}
