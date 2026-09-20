"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultItem {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);

  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
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
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
        }
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
    };
  }, []);

  const startAudioVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const animate = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const levels = Array.from(dataArrayRef.current).slice(0, 32);
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (err) {
      console.warn("Audio visualizer unavailable:", err);
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
    setAudioLevels(Array(32).fill(0));
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      setInterimTranscript("");
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript: transcript + interimTranscript,
    error,
    isSupported,
    audioLevels,
    startListening,
    stopListening,
    resetTranscript,
  };
}

export function extractEmergencyKeywords(text: string): {
  urgency: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  categories: ("Medical" | "Water" | "Food" | "Extraction" | "Shelter" | "Other")[];
} {
  const lowerText = text.toLowerCase();

  const criticalKeywords = [
    "dying",
    "dead",
    "critical",
    "severe",
    "bleeding",
    "heart attack",
    "stroke",
    "unconscious",
    "not breathing",
    "trapped",
    "collapsed",
    "fire",
    "explosion",
  ];
  const highKeywords = [
    "injured",
    "hurt",
    "pain",
    "broken",
    "fracture",
    "wound",
    "burn",
    "drowning",
    "suffocating",
    "chest pain",
    "can't breathe",
  ];
  const moderateKeywords = [
    "sick",
    "ill",
    "fever",
    "vomit",
    "dehydrated",
    "hungry",
    "thirsty",
    "cold",
    "lost",
    "stranded",
  ];

  let urgency: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" = "LOW";
  if (criticalKeywords.some((k) => lowerText.includes(k))) urgency = "CRITICAL";
  else if (highKeywords.some((k) => lowerText.includes(k))) urgency = "HIGH";
  else if (moderateKeywords.some((k) => lowerText.includes(k))) urgency = "MODERATE";

  const categories: ("Medical" | "Water" | "Food" | "Extraction" | "Shelter" | "Other")[] = [];

  if (
    lowerText.includes("medical") ||
    lowerText.includes("doctor") ||
    lowerText.includes("hospital") ||
    lowerText.includes("medic") ||
    lowerText.includes("injured") ||
    lowerText.includes("hurt") ||
    lowerText.includes("bleeding") ||
    lowerText.includes("wound") ||
    lowerText.includes("pain") ||
    lowerText.includes("sick")
  ) {
    categories.push("Medical");
  }
  if (
    lowerText.includes("water") ||
    lowerText.includes("thirsty") ||
    lowerText.includes("drink") ||
    lowerText.includes("dehydrated")
  ) {
    categories.push("Water");
  }
  if (
    lowerText.includes("food") ||
    lowerText.includes("hungry") ||
    lowerText.includes("eat") ||
    lowerText.includes("starving")
  ) {
    categories.push("Food");
  }
  if (
    lowerText.includes("trapped") ||
    lowerText.includes("stuck") ||
    lowerText.includes("rescue") ||
    lowerText.includes("extract") ||
    lowerText.includes("buried") ||
    lowerText.includes("collapsed") ||
    lowerText.includes("debris")
  ) {
    categories.push("Extraction");
  }
  if (
    lowerText.includes("shelter") ||
    lowerText.includes("roof") ||
    lowerText.includes("house") ||
    lowerText.includes("home") ||
    lowerText.includes("cold") ||
    lowerText.includes("warm")
  ) {
    categories.push("Shelter");
  }

  if (categories.length === 0) {
    categories.push("Other");
  }

  return { urgency, categories };
}