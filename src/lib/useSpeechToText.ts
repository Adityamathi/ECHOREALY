'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { db, type SosPacket } from '@/lib/db';
import { encodeSosToBuffer } from '@/lib/bleProtocol';

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: any;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionCtor {
  new (): any;
  prototype: any;
}

const DEFAULT_LOCATION = { lat: 13.0827, lng: 80.2707 };

const CRITICAL_KEYWORDS = ['trapped', 'bleeding', 'unconscious', 'not breathing', 'heart attack', 'stroke', 'severe', 'critical', 'dying', 'collapse', 'crushed', 'suffocat'];
const HIGH_KEYWORDS = ['injured', 'hurt', 'broken', 'fracture', 'wound', 'burn', 'drowning', 'chest pain', "can't breathe", 'help', 'emergency', 'urgent'];
const MEDICAL_KEYWORDS = ['medical', 'doctor', 'hospital', 'medic', 'ambulance', 'medicine', 'sick', 'pain', 'injured', 'hurt', 'bleeding', 'wound'];
const EXTRACTION_KEYWORDS = ['trapped', 'stuck', 'buried', 'collapse', 'debris', 'rescue', 'extract', 'pinned', 'under'];
const SUPPLIES_KEYWORDS = ['water', 'food', 'hungry', 'thirsty', 'supplies', 'blanket', 'warm', 'cold', 'shelter'];

function extractEmergencyData(transcript: string): { urgency: SosPacket['urgency']; category: SosPacket['category'] } {
  const text = transcript.toLowerCase();

  let urgency: SosPacket['urgency'] = 'MODERATE';
  if (CRITICAL_KEYWORDS.some(k => text.includes(k))) urgency = 'CRITICAL';
  else if (HIGH_KEYWORDS.some(k => text.includes(k))) urgency = 'HIGH';

  let category: SosPacket['category'] = 'General';
  if (MEDICAL_KEYWORDS.some(k => text.includes(k))) category = 'Medical';
  else if (EXTRACTION_KEYWORDS.some(k => text.includes(k))) category = 'Extraction';
  else if (SUPPLIES_KEYWORDS.some(k => text.includes(k))) category = 'Supplies';

  return { urgency, category };
}

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [lastSavedPacket, setLastSavedPacket] = useState<SosPacket | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        startAudioVisualizer();
      };

      recognition.onend = () => {
        setIsListening(false);
        stopAudioVisualizer();
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(event.error);
        setIsListening(false);
        stopAudioVisualizer();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
          setTranscript(prev => prev + finalTranscript);
        }
        interimRef.current = interimTranscript;
        setInterimTranscript(interimTranscript);
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      stopAudioVisualizer();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startAudioVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const animate = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        const dataArray = dataArrayRef.current as Uint8Array<ArrayBuffer>;
        analyserRef.current.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray).slice(0, 32);
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (err) {
      console.warn('Audio visualizer unavailable:', err);
    }
  }, []);

  const stopAudioVisualizer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevels(Array(32).fill(0));
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      transcriptRef.current = '';
      interimRef.current = '';
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      try {
        recognitionRef.current.start();
      } catch {
        // already started — force a clean restart
        try { recognitionRef.current.abort(); } catch {}
        setTimeout(() => {
          try { recognitionRef.current?.start(); } catch {}
        }, 200);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(async () => {
    if (recognitionRef.current && isListening) {
      try { recognitionRef.current.stop(); } catch {}
      const fullTranscript = (transcriptRef.current + ' ' + interimRef.current).trim();
      if (fullTranscript) {
        const { urgency, category } = extractEmergencyData(fullTranscript);

        const packet: SosPacket = {
          id: `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          transcript: fullTranscript,
          urgency,
          category,
          lat: DEFAULT_LOCATION.lat,
          lng: DEFAULT_LOCATION.lng,
          synced: false,
          hopCount: 0,
          viaBleBeacon: false,
        };

        await db.sosPackets.put(packet);
        setLastSavedPacket(packet);
        return packet;
      }
    }
    return null;
  }, [isListening]);

  const forceStopAndSave = useCallback(async (): Promise<SosPacket | null> => {
    try { recognitionRef.current?.stop?.(); } catch {}
    try { recognitionRef.current?.abort?.(); } catch {}
    stopAudioVisualizer();
    setIsListening(false);

    const fullTranscript = (transcriptRef.current + ' ' + interimRef.current).trim();
    if (!fullTranscript) return null;

    const { urgency, category } = extractEmergencyData(fullTranscript);
    const packet: SosPacket = {
      id: `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      transcript: fullTranscript,
      urgency,
      category,
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
      synced: false,
      hopCount: 0,
      viaBleBeacon: false,
    };

    await db.sosPackets.put(packet);
    setLastSavedPacket(packet);
    return packet;
  }, [stopAudioVisualizer]);

  const saveManualTranscript = useCallback(async (text: string): Promise<SosPacket | null> => {
    const t = text.trim();
    if (!t) return null;
    const { urgency, category } = extractEmergencyData(t);
    const packet: SosPacket = {
      id: `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      transcript: t,
      urgency,
      category,
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
      synced: false,
      hopCount: 0,
      viaBleBeacon: false,
    };
    await db.sosPackets.put(packet);
    setLastSavedPacket(packet);
    return packet;
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = '';
    interimRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setLastSavedPacket(null);
  }, []);

  const getBleBuffer = useCallback((): ArrayBuffer | null => {
    if (!lastSavedPacket) return null;
    return encodeSosToBuffer(lastSavedPacket);
  }, [lastSavedPacket]);

  return {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript: transcript + interimTranscript,
    error,
    isSupported,
    audioLevels,
    lastSavedPacket,
    startListening,
    stopListening,
    forceStopAndSave,
    saveManualTranscript,
    resetTranscript,
    getBleBuffer,
  };
}