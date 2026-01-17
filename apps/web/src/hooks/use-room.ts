import usePartySocket from "partysocket/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    type WSMessage,
    type RoomSnapshotPayload,
    type JoinRoomPayload,
    type ChatMessage,
    type EventLogEntry,
} from "@leet99/contracts";

const PARTY_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";

type StoredAuth = {
    roomId: string;
    playerId: string;
    playerToken: string;
    wsUrl: string;
};

export function useRoom(roomId: string) {
    const router = useRouter();
    const [snapshot, setSnapshot] = useState<RoomSnapshotPayload | null>(null);
    const [connected, setConnected] = useState(false);

    // Get auth from local storage
    const [auth, setAuth] = useState<StoredAuth | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const item = localStorage.getItem(`room_${roomId}`);
            if (item) {
                setAuth(JSON.parse(item));
            } else {
                // No auth token, router logic handled in page or middleware
            }
        }
    }, [roomId]);

    const socket = usePartySocket({
        host: PARTY_HOST,
        room: roomId,
        party: "leet99",
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
        onMessage: (evt) => {
            const msg = JSON.parse(evt.data);

            switch (msg.type) {
                case "ROOM_SNAPSHOT":
                    setSnapshot(msg.payload);
                    break;

                case "PLAYER_UPDATE":
                    // Use functional update to avoid stale closure
                    setSnapshot(prev => {
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
                    setSnapshot(prev => {
                        if (!prev) return prev;
                        return { ...prev, match: msg.payload.match };
                    });
                    break;

                case "CHAT_APPEND":
                    setSnapshot(prev => {
                        if (!prev) return prev;
                        return { ...prev, chat: [...prev.chat, msg.payload.message] };
                    });
                    break;

                case "EVENT_LOG_APPEND":
                    setSnapshot(prev => {
                        if (!prev) return prev;
                        return { ...prev, eventLog: [...prev.eventLog, msg.payload.entry] };
                    });
                    break;

                case "SETTINGS_UPDATE":
                    setSnapshot(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            match: { ...prev.match, settings: msg.payload.settings }
                        };
                    });
                    break;
            }
        },
    });

    // Handle joining
    useEffect(() => {
        if (socket && connected && auth) {
            const msg: WSMessage<"JOIN_ROOM", JoinRoomPayload> = {
                type: "JOIN_ROOM",
                payload: { playerToken: auth.playerToken },
            };
            socket.send(JSON.stringify(msg));
        }
    }, [socket, connected, auth]);

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
