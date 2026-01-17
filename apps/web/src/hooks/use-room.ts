import usePartySocket from "partysocket/react";
import { useState, useEffect, useCallback } from "react";
import {
    type WSMessage,
    type RoomSnapshotPayload,
    type JoinRoomPayload,
    type ChatMessage,
    type EventLogEntry,
} from "@leet99/contracts";

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
const PARTY_NAME =
    process.env.NEXT_PUBLIC_PARTYKIT_PARTY ||
    process.env.NEXT_PUBLIC_PARTYKIT_PROJECT ||
    "leet99";

type PartySocketConfig = {
    host: string;
    party: string;
    room: string;
};

function normalizePartyHost(host: string): string {
    return host.replace(/^https?:\/\//, "");
}

function parsePartySocketConfig(wsUrl: string): PartySocketConfig | null {
    try {
        const url = new URL(wsUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] !== "parties" || parts.length < 3) {
            return null;
        }
        return {
            host: url.host,
            party: parts[1] ?? PARTY_NAME,
            room: parts[2] ?? "",
        };
    } catch {
        return null;
    }
}

export type StoredAuth = {
    roomId: string;
    playerId: string;
    playerToken: string;
    wsUrl: string;
};

export function useRoom(roomId: string, auth: StoredAuth) {
    const [snapshot, setSnapshot] = useState<RoomSnapshotPayload | null>(null);
    const [connected, setConnected] = useState(false);
    const [connectionNonce, setConnectionNonce] = useState(0);

    const parsed = auth?.wsUrl ? parsePartySocketConfig(auth.wsUrl) : null;
    const socket = usePartySocket({
        host: parsed?.host ?? normalizePartyHost(PARTY_HOST),
        room: parsed?.room || roomId,
        party: parsed?.party || PARTY_NAME,
        onOpen: () => {
            setConnected(true);
            setConnectionNonce((count) => count + 1);
        },
        onClose: () => setConnected(false),
        onMessage: (evt) => {
            const msg = JSON.parse(evt.data);

            switch (msg.type) {
                case "ROOM_SNAPSHOT":
                    setSnapshot(msg.payload);
                    break;

                case "PLAYER_UPDATE":
                    setSnapshot((prev) => {
                        if (!prev) return prev;
                        const newPlayers = [...prev.players];
                        const idx = newPlayers.findIndex(p => p.playerId === msg.payload.player.playerId);
                        if (idx >= 0) {
                            newPlayers[idx] = msg.payload.player;
                        } else {
                            newPlayers.push(msg.payload.player);
                        }
                        return { ...prev, players: newPlayers };
                    });
                    break;

                case "MATCH_STARTED":
                    setSnapshot((prev) => {
                        if (!prev) return prev;
                        return { ...prev, match: msg.payload.match };
                    });
                    break;

                case "CHAT_APPEND":
                    setSnapshot((prev) => {
                        if (!prev) return prev;
                        return { ...prev, chat: [...prev.chat, msg.payload.message] };
                    });
                    break;

                case "EVENT_LOG_APPEND":
                    setSnapshot((prev) => {
                        if (!prev) return prev;
                        return { ...prev, eventLog: [...prev.eventLog, msg.payload.entry] };
                    });
                    break;

                case "SETTINGS_UPDATE":
                    setSnapshot((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            match: {
                                ...prev.match,
                                settings: msg.payload.settings,
                            },
                        };
                    });
                    break;
            }
        },
    });

    // Handle joining
    useEffect(() => {
        if (!socket || !auth) return;
        if (typeof WebSocket !== "undefined" && socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const msg: WSMessage<"JOIN_ROOM", JoinRoomPayload> = {
            type: "JOIN_ROOM",
            payload: { playerToken: auth.playerToken },
        };
        socket.send(JSON.stringify(msg));
    }, [socket, auth, connectionNonce]);

    const startMatch = useCallback(() => {
        console.log("[useRoom] startMatch called", { socketReady: !!socket });
        if (!socket) return;
        socket.send(JSON.stringify({ type: "START_MATCH" }));
    }, [socket]);

    const addBots = useCallback((count: number) => {
        if (!socket) return;
        socket.send(JSON.stringify({ type: "ADD_BOTS", payload: { count } }));
    }, [socket]);

    const sendMessage = useCallback((text: string) => {
        if (!socket) return;
        socket.send(JSON.stringify({ type: "SEND_CHAT", payload: { text } }));
    }, [socket]);

    return {
        socket,
        connected,
        snapshot,
        me: snapshot?.me,
        players: snapshot?.players || [],
        chat: snapshot?.chat || [],
        isHost: snapshot?.me?.isHost || false,
        startMatch,
        addBots,
        sendMessage
    };
}
