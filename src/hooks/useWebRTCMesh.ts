"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { SOSRecord, MeshPeer } from "@/lib/types";

const SIGNALING_CHANNEL = "echorealy-signaling";

export function useWebRTCMesh(
  onPeerConnected: (peer: MeshPeer) => void,
  onPeerDisconnected: (peerId: string) => void,
  onRecordReceived: (record: SOSRecord) => void
) {
  const [peers, setPeers] = useState<MeshPeer[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localPeerId] = useState(() => `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());

  const onPeerConnectedRef = useRef(onPeerConnected);
  const onPeerDisconnectedRef = useRef(onPeerDisconnected);
  const onRecordReceivedRef = useRef(onRecordReceived);

  onPeerConnectedRef.current = onPeerConnected;
  onPeerDisconnectedRef.current = onPeerDisconnected;
  onRecordReceivedRef.current = onRecordReceived;

  const STUN_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const createPeerConnection = useCallback(
    (targetPeerId: string, isInitiator: boolean) => {
      const pc = new RTCPeerConnection(STUN_SERVERS);
      peerConnectionsRef.current.set(targetPeerId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(targetPeerId, {
            type: "ice-candidate",
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          const peer: MeshPeer = {
            id: targetPeerId,
            name: `Peer ${targetPeerId.slice(0, 8)}`,
            connectedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
          };
          setPeers((prev) => {
            if (!prev.find((p) => p.id === targetPeerId)) {
              onPeerConnectedRef.current(peer);
              return [...prev, peer];
            }
            return prev;
          });
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          cleanupPeer(targetPeerId);
        }
      };

      if (isInitiator) {
        const channel = pc.createDataChannel("echorealy-data", { ordered: true });
        setupDataChannel(channel, targetPeerId);
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel, targetPeerId);
        };
      }

      return pc;
    },
    []
  );

  const setupDataChannel = useCallback(
    (channel: RTCDataChannel, targetPeerId: string) => {
      channel.onopen = () => {
        console.log(`Data channel opened with ${targetPeerId}`);
      };

      channel.onclose = () => {
        console.log(`Data channel closed with ${targetPeerId}`);
        cleanupPeer(targetPeerId);
      };

      channel.onerror = (error) => {
        console.error(`Data channel error with ${targetPeerId}:`, error);
      };

      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "sos-record") {
            onRecordReceivedRef.current(data.payload);
          } else if (data.type === "sync-request") {
            sendRecordsToPeer(targetPeerId);
          }
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };

      dataChannelsRef.current.set(targetPeerId, channel);
    },
    []
  );

  const sendSignal = useCallback(
    (targetPeerId: string, signal: unknown) => {
      console.log(`Signal to ${targetPeerId}:`, signal);
    },
    []
  );

  const connectToPeer = useCallback(
    async (targetPeerId: string) => {
      if (peerConnectionsRef.current.has(targetPeerId)) return;

      setIsConnecting(true);
      const pc = createPeerConnection(targetPeerId, true);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(targetPeerId, {
          type: "offer",
          sdp: pc.localDescription?.toJSON(),
        });
      } catch (err) {
        console.error("Failed to create offer:", err);
        setIsConnecting(false);
      }
    },
    [createPeerConnection, sendSignal]
  );

  const handleSignal = useCallback(
    async (fromPeerId: string, signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
      let pc = peerConnectionsRef.current.get(fromPeerId);

      if (!pc) {
        pc = createPeerConnection(fromPeerId, false);
      }

      try {
        if (signal.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(fromPeerId, {
            type: "answer",
            sdp: pc.localDescription?.toJSON(),
          });
        } else if (signal.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
        } else if (signal.type === "ice-candidate") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate!));
          } else {
            const candidates = pendingCandidatesRef.current.get(fromPeerId) || [];
            candidates.push(new RTCIceCandidate(signal.candidate!));
            pendingCandidatesRef.current.set(fromPeerId, candidates);
          }
        }
      } catch (err) {
        console.error("Signal handling error:", err);
      }
    },
    [createPeerConnection, sendSignal]
  );

  const sendRecordsToPeer = useCallback(
    async (targetPeerId: string) => {
      const channel = dataChannelsRef.current.get(targetPeerId);
      if (!channel || channel.readyState !== "open") return;

      const { getPendingRecords } = await import("@/lib/db");
      const records = await getPendingRecords();

      channel.send(
        JSON.stringify({
          type: "sos-batch",
          payload: records,
        })
      );
    },
    []
  );

  const broadcastRecord = useCallback(
    (record: SOSRecord) => {
      const message = JSON.stringify({
        type: "sos-record",
        payload: record,
      });

      dataChannelsRef.current.forEach((channel) => {
        if (channel.readyState === "open") {
          channel.send(message);
        }
      });
    },
    []
  );

  const cleanupPeer = useCallback((targetPeerId: string) => {
    const pc = peerConnectionsRef.current.get(targetPeerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(targetPeerId);
    }
    dataChannelsRef.current.delete(targetPeerId);
    pendingCandidatesRef.current.delete(targetPeerId);
    setPeers((prev) => prev.filter((p) => p.id !== targetPeerId));
    onPeerDisconnectedRef.current(targetPeerId);
  }, []);

  const disconnectAll = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, peerId) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    dataChannelsRef.current.clear();
    setPeers([]);
  }, []);

  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      dataChannelsRef.current.clear();
    };
  }, []);

  return {
    localPeerId,
    peers,
    isConnecting,
    connectToPeer,
    handleSignal,
    broadcastRecord,
    sendRecordsToPeer,
    disconnectAll,
  };
}

export function generateQRCodeData(records: SOSRecord[]): string {
  const compressed = records.map((r) => ({
    i: r.id,
    t: r.timestamp,
    tr: r.transcript.slice(0, 200),
    u: r.urgency,
    c: r.category,
    lat: r.latitude,
    lng: r.longitude,
    s: r.status,
  }));
  return JSON.stringify(compressed);
}

export function parseQRCodeData(data: string): Partial<SOSRecord>[] {
  try {
    const parsed = JSON.parse(data);
    return parsed.map((r: { i: string; t: string; tr: string; u: string; c: string[]; lat: number; lng: number; s: string }) => ({
      id: r.i,
      timestamp: r.t,
      transcript: r.tr,
      urgency: r.u as SOSRecord["urgency"],
      category: r.c as SOSRecord["category"],
      latitude: r.lat,
      longitude: r.lng,
      status: r.s as SOSRecord["status"],
    }));
  } catch {
    return [];
  }
}