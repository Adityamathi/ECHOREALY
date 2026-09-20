'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Waves,
  Send,
  AlertTriangle,
  XCircle,
  RadioTower,
  Bluetooth,
  Zap,
  RotateCcw,
  Share2,
  Copy,
  QrCode,
  Link2,
  Smartphone,
  Check,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { useBleMesh } from '@/lib/useBleMesh';
import { db, type SosPacket } from '@/lib/db';
import { bufferToHex, encodeSosToBuffer } from '@/lib/bleProtocol';
import { buildSosUrl, buildSosUrlOnHost, buildSosMessage, shareViaSystem, shareViaBluetooth, copyToClipboard, isLocalhostHostname, getLocalIPsViaWebRTC } from '@/lib/shareUtils';
import QRCode from 'qrcode';

export function VictimView() {
  const {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript,
    error,
    isSupported,
    audioLevels,
    lastSavedPacket,
    startListening,
    forceStopAndSave,
    saveManualTranscript,
    resetTranscript,
    getBleBuffer,
  } = useSpeechToText();

  const {
    isAdvertising,
    isScanning,
    startAdvertising,
    stopAdvertising,
    requestNotificationPermission,
  } = useBleMesh();

  const [savedPackets, setSavedPackets] = useState<SosPacket[]>([]);
  const [manualText, setManualText] = useState('');
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [lanBase, setLanBase] = useState<string | null>(null);
  const [showBtHelp, setShowBtHelp] = useState(false);
  const [detectingIp, setDetectingIp] = useState(false);
  const [micPerm, setMicPerm] = useState<string | null>(null);
  const [lastSentHex, setLastSentHex] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [shareSupported] = useState(
    () => typeof navigator !== 'undefined' && 'share' in navigator
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadPackets();
    requestNotificationPermission();
    try {
      (navigator as any).permissions
        ?.query?.({ name: 'microphone' as any })
        .then((s: any) => {
          setMicPerm(s.state);
          s.onchange = () => setMicPerm(s.state);
        })
        .catch(() => {});
    } catch {}
  }, [requestNotificationPermission]);

  useEffect(() => {
    if (lastSavedPacket) {
      setSavedPackets((prev) => {
        if (prev.some((p) => p.id === lastSavedPacket.id)) return prev;
        return [lastSavedPacket, ...prev];
      });
      setQrDataUrl(null);
      setShowQR(false);
    }
  }, [lastSavedPacket]);

  useEffect(() => {
    let cancelled = false;
    getLocalIPsViaWebRTC().then((ips) => {
      if (cancelled) return;
      setLanIps(ips);
      if (ips.length > 0) {
        const port = window.location.port || '3001';
        setLanBase(`${ips[0]}:${port}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lastSavedPacket) return;
    if (lanBase) setShareUrl(buildSosUrlOnHost(lastSavedPacket, lanBase));
    else setShareUrl(buildSosUrl(lastSavedPacket));
  }, [lastSavedPacket, lanBase]);

  const loadPackets = async () => {
    const packets = await db.sosPackets.orderBy('timestamp').reverse().limit(20).toArray();
    setSavedPackets(packets);
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleStopAndSave = useCallback(async () => {
    const packet = await forceStopAndSave();
    await loadPackets();
    if (!packet) showFeedback('Recording stopped — no speech detected. Type your message below.');
    else showFeedback('Recording stopped and SOS saved below');
  }, [forceStopAndSave]);

  const handleManualSave = useCallback(async () => {
    if (!manualText.trim()) return;
    await saveManualTranscript(manualText);
    setManualText('');
    await loadPackets();
    showFeedback('Typed SOS saved below — now broadcast it');
  }, [manualText, saveManualTranscript]);

  const handleBroadcastBle = useCallback(() => {
    if (!lastSavedPacket) {
      showFeedback('Record and save an SOS first');
      return;
    }
    const buffer = encodeSosToBuffer(lastSavedPacket);
    startAdvertising(buffer);
    setLastSentHex(bufferToHex(buffer));
    setShareUrl(buildSosUrl(lastSavedPacket));
    showFeedback('BLE advertising started (30-50m)');
  }, [lastSavedPacket, startAdvertising]);

  const handleSystemShare = useCallback(async () => {
    if (!lastSavedPacket || !shareUrl) {
      showFeedback('Record and save an SOS first');
      return;
    }
    const result = await shareViaSystem(lastSavedPacket, shareUrl);
    if (result === 'shared') showFeedback('Shared — pick Bluetooth / Nearby Share / WhatsApp');
    else if (result === 'cancelled') showFeedback('Share cancelled');
    else if (result === 'unsupported') showFeedback('System share not supported — use QR or Copy Link');
    else showFeedback('Share failed — use QR or Copy Link');
  }, [lastSavedPacket, shareUrl]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    showFeedback(ok ? 'SOS link copied — paste in WhatsApp / SMS / Bluetooth' : 'Copy failed');
  }, [shareUrl]);

  const handleBluetoothSend = useCallback(async () => {
    if (!lastSavedPacket || !shareUrl) {
      showFeedback('Record and save an SOS first');
      return;
    }
    const result = await shareViaBluetooth(lastSavedPacket, shareUrl);
    if (result === 'shared') {
      showFeedback('Sent — on the phone: Accept the Bluetooth transfer, tap its notification, then tap the SOS link');
    } else if (result === 'cancelled') {
      showFeedback('Bluetooth share cancelled');
    } else {
      setShowBtHelp(true);
      showFeedback('System share unavailable — follow the Bluetooth steps below');
    }
  }, [lastSavedPacket, shareUrl]);

  const handleCopyText = useCallback(async () => {
    if (!lastSavedPacket || !shareUrl) return;
    const ok = await copyToClipboard(buildSosMessage(lastSavedPacket, shareUrl));
    showFeedback(ok ? 'SOS message copied' : 'Copy failed');
  }, [lastSavedPacket, shareUrl]);

  const handleShowQR = useCallback(async () => {
    if (!shareUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, { width: 280, margin: 2 });
      setQrDataUrl(dataUrl);
      setShowQR(true);
    } catch {
      showFeedback('QR generation failed');
    }
  }, [shareUrl]);

  const handlePreviewAlert = useCallback(() => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank');
  }, [shareUrl]);

  const onLocalhost =
    typeof window !== 'undefined' && isLocalhostHostname(window.location.hostname);

  const handleDetectIp = useCallback(async () => {
    setDetectingIp(true);
    const ips = await getLocalIPsViaWebRTC();
    setLanIps(ips);
    setDetectingIp(false);
    if (ips.length > 0) {
      const port = window.location.port || '3001';
      setLanBase(`${ips[0]}:${port}`);
      showFeedback(`Phone link auto-set to http://${ips[0]}:${port}`);
    } else {
      showFeedback('Could not detect IP — open the terminal Network URL on the laptop instead');
    }
  }, []);

  const handleUseIp = useCallback((ip: string) => {
    const port = typeof window !== 'undefined' ? window.location.port || '3001' : '3001';
    setLanBase(`${ip}:${port}`);
    setQrDataUrl(null);
    setShowQR(false);
    showFeedback(`Phone link set to http://${ip}:${port} — QR and Share use it now`);
  }, []);

  const handleLocalNotify = useCallback(async () => {
    if (!lastSavedPacket) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚨 SOS — ${lastSavedPacket.urgency} ${lastSavedPacket.category}`, {
        body: lastSavedPacket.transcript.slice(0, 120),
        icon: '/icon-192.png',
      });
      showFeedback('Local SOS popup shown');
    } else {
      await requestNotificationPermission();
      showFeedback('Enable notifications, then tap again');
    }
  }, [lastSavedPacket, requestNotificationPermission]);

  const urgencyColor = lastSavedPacket
    ? lastSavedPacket.urgency === 'CRITICAL'
      ? 'bg-[#EF4444]'
      : lastSavedPacket.urgency === 'HIGH'
        ? 'bg-[#F59E0B]'
        : 'bg-[#06B6D4]'
    : 'bg-slate-700';

  const urgencyLabel = lastSavedPacket?.urgency || 'UNKNOWN';

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 gap-4">
      <div className="grid gap-4 md:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4 min-h-0">
          <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Waves className="w-5 h-5 text-[#EF4444]" />
                Emergency Voice SOS
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 p-0 pt-4">
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
                <button
                  onClick={() => (isListening ? handleStopAndSave() : startListening())}
                  disabled={!isSupported}
                  className={`
                    relative w-48 h-48 rounded-full border-4 border-slate-700
                    transition-all duration-300 flex items-center justify-center
                    ${isListening
                      ? 'bg-gradient-to-br from-[#EF4444] to-[#F59E0B] border-[#EF4444]/50 animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                      : 'bg-slate-800/50 hover:border-slate-600'
                    }
                    ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  aria-label={isListening ? 'Stop recording and save' : 'Start recording'}
                >
                  {isListening ? (
                    <Square className="w-16 h-16 text-white drop-shadow-lg" />
                  ) : (
                    <Mic className="w-16 h-16 text-slate-300" />
                  )}
                </button>

                {isListening && audioLevels.length > 0 && (
                  <div className="flex items-end gap-1 h-20">
                    {audioLevels.slice(0, 24).map((level, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded bg-[#EF4444]/80"
                        style={{ height: `${Math.max(4, (level / 255) * 70)}px` }}
                      />
                    ))}
                  </div>
                )}

                <div className="w-full max-w-md text-center">
                  {isListening ? (
                    <p className="text-lg font-medium text-[#EF4444] animate-pulse">
                      Recording… Tap STOP to finish
                    </p>
                  ) : !isSupported ? (
                    <p className="text-slate-500">Speech recognition not supported in this browser</p>
                  ) : (
                    <p className="text-slate-500">Tap the mic to START, tap again to STOP and save</p>
                  )}

                  {error && (
                    <p className="text-sm text-[#EF4444] mt-2" role="alert">
                      {error === 'not-allowed'
                        ? 'Mic blocked: open http://localhost:3001 on THIS laptop (not the Wi-Fi IP — Chrome only allows the mic on localhost/HTTPS), click the lock icon → allow Microphone, and use Chrome/Edge. Or type your message below.'
                        : error === 'no-speech'
                          ? 'No speech heard — speak closer/louder and try again, or type your message below.'
                          : error === 'audio-capture'
                            ? 'No microphone found on this device — type your message below.'
                            : error === 'network'
                              ? 'Speech service needs internet (Chrome processes voice online). Offline right now? Type your message below.'
                              : `Error: ${error}`}
                    </p>
                  )}
                  {onLocalhost === false && (
                    <div className="mt-2 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/40">
                      <p className="text-xs text-[#F59E0B] mb-2">
                        You're on the Wi-Fi address — mic is blocked here by Chrome. Click once to open the recording
                        tab:
                      </p>
                      <Button
                        className="w-full gap-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-bold"
                        onClick={() => window.open('http://localhost:3001', '_blank')}
                      >
                        <Mic className="w-4 h-4" />
                        Open Recording Tab (localhost)
                      </Button>
                      {micPerm === 'denied' && (
                        <p className="text-xs text-[#EF4444] mt-2">
                          Microphone is BLOCKED for this site: click the lock icon → Microphone → Allow, then reload
                          the page.
                        </p>
                      )}
                    </div>
                  )}
                  {onLocalhost === true && micPerm === 'denied' && (
                    <p className="text-xs text-[#EF4444] mt-2">
                      Microphone is BLOCKED: click the lock icon → Microphone → Allow, then reload this page.
                    </p>
                  )}

                  {fullTranscript && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg text-left max-h-40 overflow-auto">
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{fullTranscript}</p>
                    </div>
                  )}
                </div>

                <div className="w-full max-w-md flex flex-wrap gap-3">
                  {!isListening ? (
                    <Button
                      size="lg"
                      className="flex-1 gap-2 bg-[#EF4444] hover:bg-[#EF4444]/90 text-white"
                      onClick={startListening}
                      disabled={!isSupported}
                    >
                      <Play className="w-5 h-5" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="flex-1 gap-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-bold"
                      onClick={handleStopAndSave}
                    >
                      <Square className="w-5 h-5" />
                      Stop Recording and Save
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={resetTranscript}
                    disabled={!fullTranscript.trim() && !lastSavedPacket}
                  >
                    <XCircle className="w-5 h-5" />
                    Discard
                  </Button>
                </div>

                <div className="w-full max-w-md p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Mic not working? Type your emergency below:</p>
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="e.g. Trapped on 2nd floor, need medical help for 3 people"
                    rows={2}
                    className="w-full p-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white placeholder:text-slate-600"
                  />
                  <Button
                    className="w-full mt-2 gap-2 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-black font-bold"
                    onClick={handleManualSave}
                    disabled={!manualText.trim()}
                  >
                    <Send className="w-4 h-4" />
                    Save Typed SOS
                  </Button>
                </div>
              </div>

              {lastSavedPacket && (
                <div className="mx-6 mb-4">
                  <div
                    className={`p-4 rounded-xl border-l-4 ${urgencyColor} bg-slate-800/50 animate-slide-in`}
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">SOS Saved — {urgencyLabel} Priority</p>
                        <p className="text-sm text-slate-400">
                          {lastSavedPacket.category} • Lat: {lastSavedPacket.lat.toFixed(4)}, Lng:{' '}
                          {lastSavedPacket.lng.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 p-4 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/30">
                    <p className="font-bold text-white flex items-center gap-2 mb-1">
                      <Send className="w-4 h-4 text-[#06B6D4]" />
                      Broadcast SOS to nearby devices
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      Uses your phone/laptop share sheet (Bluetooth, Nearby Share, WhatsApp, SMS) + a link that pops a
                      full-screen SOS alert on the receiver.
                    </p>
                    {shareUrl && (shareUrl.includes('localhost') || shareUrl.includes('127.0.0.1')) && !lanBase && (
                      <div className="mb-3 p-3 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-xs text-[#F59E0B]">
                        <b>Phone can't open this link yet:</b> it says <span className="font-mono">localhost</span>.
                        Detecting your Wi-Fi address… if this stays, tap “Find my Wi-Fi IP”.
                      </div>
                    )}
                    {shareUrl && !shareUrl.includes('localhost') && !shareUrl.includes('127.0.0.1') && (
                      <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-300">
                        <b>Phone-ready link active.</b> QR and Share below send this address to the phone.
                      </div>
                    )}
                    <div className="mb-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5 text-[#06B6D4]" />
                          Phone connection{lanBase ? `: http://${lanBase}` : ''}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-slate-600"
                          onClick={handleDetectIp}
                          disabled={detectingIp}
                        >
                          {detectingIp ? 'Detecting…' : lanBase ? 'Re-detect' : 'Find my Wi-Fi IP'}
                        </Button>
                      </div>
                      {lanIps.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {lanIps.map((ip) => (
                            <div key={ip} className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-[#06B6D4]">
                                http://{ip}:{typeof window !== 'undefined' ? window.location.port || '3001' : '3001'}
                              </span>
                              <Button size="sm" className="h-7 text-xs" onClick={() => handleUseIp(ip)}>
                                Use
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="gap-2 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-black font-bold col-span-2" onClick={handleBluetoothSend}>
                        <Bluetooth className="w-4 h-4" />
                        Send via Bluetooth to Phone
                      </Button>
                      <Button className="gap-2 bg-[#EF4444] hover:bg-[#EF4444]/90 text-white font-bold" onClick={handleSystemShare}>
                        <Share2 className="w-4 h-4" />
                        {shareSupported ? 'Broadcast via…' : 'Broadcast SOS'}
                      </Button>
                      <Button variant="outline" className="gap-2 border-slate-700" onClick={handleBroadcastBle}>
                        <Bluetooth className="w-4 h-4" />
                        BLE Advertise
                      </Button>
                      <Button variant="outline" className="gap-2 border-slate-700" onClick={handleShowQR}>
                        <QrCode className="w-4 h-4" />
                        Show QR
                      </Button>
                      <Button variant="outline" className="gap-2 border-slate-700" onClick={handleCopyLink}>
                        <Link2 className="w-4 h-4" />
                        Copy SOS Link
                      </Button>
                      <Button variant="outline" className="gap-2 border-slate-700" onClick={handleCopyText}>
                        <Copy className="w-4 h-4" />
                        Copy SOS Text
                      </Button>
                      <Button variant="outline" className="gap-2 border-slate-700" onClick={handleLocalNotify}>
                        <Bell className="w-4 h-4" />
                        Test Popup
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-1 text-xs text-slate-400"
                      onClick={() => setShowBtHelp(!showBtHelp)}
                    >
                      {showBtHelp ? 'Hide Bluetooth setup steps' : 'Show Bluetooth setup steps'}
                    </Button>
                    {showBtHelp && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300 space-y-1.5">
                        <p><b className="text-white">1. Pair once:</b> Windows Settings → Bluetooth & devices → Add device → Bluetooth → pick your phone.</p>
                        <p><b className="text-white">2. Send:</b> tap <b>Send via Bluetooth to Phone</b> → choose <b>Bluetooth</b> → your phone → Send.</p>
                        <p><b className="text-white">3. On phone:</b> Accept the transfer → tap the Bluetooth notification → tap the SOS link → alert pops with siren.</p>
                        <Button size="sm" variant="outline" className="w-full mt-1 gap-2 border-slate-600" onClick={handleCopyText}>
                          <Copy className="w-3.5 h-3.5" />
                          Copy SOS text (paste into Bluetooth file-send instead)
                        </Button>
                      </div>
                    )}
                    <Button variant="ghost" className="w-full mt-2 gap-2 text-[#06B6D4]" onClick={handlePreviewAlert}>
                      <Smartphone className="w-4 h-4" />
                      Preview what phone sees
                    </Button>
                    {shareUrl && (
                      <p className="text-[11px] font-mono text-slate-500 break-all mt-2">{shareUrl}</p>
                    )}
                  </div>
                </div>
              )}

              {feedback && (
                <div className="mx-6 mb-6 p-3 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {feedback}
                </div>
              )}
            </CardContent>
          </Card>

          {showQR && qrDataUrl && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-white mb-1">Scan to receive SOS</h3>
                <p className="text-xs text-slate-400 mb-4">Point any phone camera at this — SOS alert pops up instantly</p>
                <img src={qrDataUrl} alt="SOS QR" className="w-64 h-64 mx-auto rounded-lg bg-white p-2" />
                <Button className="w-full mt-4" variant="outline" onClick={() => setShowQR(false)}>Close</Button>
              </div>
            </div>
          )}

          {savedPackets.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                  Local SOS Queue ({savedPackets.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-64 overflow-auto">
                  {savedPackets.map((packet) => (
                    <div key={packet.id} className="border-t border-slate-800 p-4 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                            packet.urgency === 'CRITICAL'
                              ? 'bg-[#EF4444]'
                              : packet.urgency === 'HIGH'
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#06B6D4]'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-300 line-clamp-2">{packet.transcript}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                packet.urgency === 'CRITICAL'
                                  ? 'bg-[#EF4444]'
                                  : packet.urgency === 'HIGH'
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#06B6D4]'
                              } text-white`}
                            >
                              {packet.urgency}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">{packet.category}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[#06B6D4] text-xs"
                              onClick={() => {
                                const url = buildSosUrl(packet);
                                setShareUrl(url);
                                shareViaSystem(packet, url);
                              }}
                            >
                              <Share2 className="w-3 h-3 mr-1" /> Share
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bluetooth className="w-5 h-5 text-[#06B6D4]" />
                Passive BLE Beaconing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isAdvertising ? 'bg-[#EF4444] animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-sm font-medium text-white">{isAdvertising ? 'Advertising Active' : 'Standby'}</span>
                </div>
                <span className="text-xs text-slate-500">~30-50m Range</span>
              </div>

              {lastSentHex && (
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Last Broadcast Hex:</p>
                  <p className="text-xs font-mono text-[#06B6D4] break-all">{lastSentHex}</p>
                </div>
              )}

              <Button
                variant={isAdvertising ? 'destructive' : 'default'}
                className="w-full gap-2"
                onClick={
                  isAdvertising
                    ? stopAdvertising
                    : () => {
                        const buffer = getBleBuffer();
                        if (buffer) {
                          startAdvertising(buffer);
                          setLastSentHex(bufferToHex(buffer));
                        } else showFeedback('Record and save an SOS first');
                      }
                }
                disabled={!lastSavedPacket && !isAdvertising}
              >
                {isAdvertising ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    Stop Advertising
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Start BLE Advertising
                  </>
                )}
              </Button>
              <Separator />
              <div className="text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">How phone popup works:</p>
                <p>1. Tap <b>Broadcast via…</b> → choose Bluetooth / Nearby Share on your laptop.</p>
                <p>2. Or tap <b>Show QR</b> → phone camera scans → SOS alert opens full-screen with siren.</p>
                <p>3. Laptop + phone must be on same Wi-Fi for the link to open (use your Network URL, e.g. http://10.x.x.x:3001).</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <RadioTower className="w-5 h-5 text-[#06B6D4]" />
                Mesh Network Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">BLE Advertising</span>
                <span className={isAdvertising ? 'text-[#EF4444]' : 'text-slate-500'}>{isAdvertising ? 'ACTIVE' : 'IDLE'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">BLE Scanning</span>
                <span className={isScanning ? 'text-[#06B6D4]' : 'text-slate-500'}>{isScanning ? 'LISTENING' : 'OFF'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
