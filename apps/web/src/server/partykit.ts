import {
  HttpErrorResponseSchema,
  PartyRegisterRequestSchema,
  PartyRegisterResponseSchema,
  type HttpErrorResponse,
  type PartyRegisterRequest,
  type PartyRegisterResponse,
} from "@leet99/contracts";
import { z } from "zod";

export function partyBaseUrl(): string {
  const host = process.env.PARTYKIT_HOST || "http://127.0.0.1:1999";

  // Validate URL format
  try {
    new URL(host);
    return host;
  } catch {
    console.error("Invalid PARTYKIT_HOST environment variable", { host });
    throw new Error(`Invalid PARTYKIT_HOST: ${host}`);
  }
}

export function partyName(): string {
  return (
    process.env.PARTYKIT_PARTY ||
    process.env.PARTYKIT_PROJECT ||
    "leet99"
  );
}

function partyRoomPath(roomId: string): string {
  return `/parties/${partyName()}/${roomId}`;
}

export function toWsUrl(roomId: string): string {
  const base = new URL(partyBaseUrl());

  const wsProtocol =
    base.protocol === "https:" || base.protocol === "wss:" ? "wss:" : "ws:";

  const wsBase = new URL(base.origin);
  wsBase.protocol = wsProtocol;

  return `${wsBase.origin}${partyRoomPath(roomId)}`;
}

export type RegisterPartyPlayerOk = {
  ok: true;
  data: PartyRegisterResponse;
};

export type RegisterPartyPlayerErr = {
  ok: false;
  status: number;
  error: HttpErrorResponse;
};

export type RegisterPartyPlayerResult =
  | RegisterPartyPlayerOk
  | RegisterPartyPlayerErr;

export async function registerPartyPlayer(
  roomId: string,
  input: PartyRegisterRequest,
): Promise<RegisterPartyPlayerResult> {
  const parsed = PartyRegisterRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid PartyRegisterRequest",
          details: parsed.error.flatten(),
        },
      },
    };
  }

  let url: URL;
  try {
    const baseUrl = partyBaseUrl();
    const path = `${partyRoomPath(roomId)}/register`;
    url = new URL(path, baseUrl);
    console.log("PartyKit register URL", {
      baseUrl,
      path,
      fullUrl: url.toString(),
      roomId,
    });
  } catch (err) {
    console.error("Failed to construct PartyKit URL", {
      roomId,
      error: err instanceof Error ? err.message : String(err),
      PARTYKIT_HOST: process.env.PARTYKIT_HOST,
    });
    return {
      ok: false,
      status: 500,
      error: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to construct PartyKit URL",
          details: err instanceof Error ? err.message : String(err),
        },
      },
    };
  }


  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(parsed.data),
    });
  } catch (err) {
    console.error("Failed to reach PartyKit", {
      url: url.toString(),
      roomId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return {
      ok: false,
      status: 502,
      error: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to reach PartyKit",
          details: err instanceof Error ? err.message : String(err),
        },
      },
    };
  }

  const status = response.status;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsedError = HttpErrorResponseSchema.safeParse(body);
    console.error("PartyKit register failed", {
      url: url.toString(),
      roomId,
      status,
      body,
      parsedError: parsedError.success ? parsedError.data : parsedError.error,
    });
    return {
      ok: false,
      status,
      error: parsedError.success
        ? parsedError.data
        : {
          error: {
            code: "INTERNAL_ERROR",
            message: "PartyKit register failed",
            details: { status, body },
          },
        },
    };
  }

  const parsedOk = PartyRegisterResponseSchema.safeParse(body);
  if (!parsedOk.success) {
    return {
      ok: false,
      status,
      error: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Invalid PartyKit register response",
          details: parsedOk.error.flatten(),
        },
      },
    };
  }

  return {
    ok: true,
    data: parsedOk.data,
  };
}

export type FetchRoomStateOk = {
  ok: true;
  data: {
    roomId: string;
    phase: string;
    playerCount: number; // Total for backwards compatibility
    playerCounts: {
      players: number;
      spectators: number;
      bots: number;
    };
    settings: Record<string, unknown>;
  };
};

export type FetchRoomStateErr = {
  ok: false;
  status: number;
  error: HttpErrorResponse;
};

export type FetchRoomStateResult = FetchRoomStateOk | FetchRoomStateErr;

export async function fetchRoomState(
  roomId: string,
): Promise<FetchRoomStateResult> {
  const url = new URL(`${partyRoomPath(roomId)}/state`, partyBaseUrl());

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to reach PartyKit",
          details: err instanceof Error ? err.message : err,
        },
      },
    };
  }

  const status = response.status;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsedError = HttpErrorResponseSchema.safeParse(body);
    return {
      ok: false,
      status,
      error: parsedError.success
        ? parsedError.data
        : {
            error: {
              code: "INTERNAL_ERROR",
              message: "PartyKit state fetch failed",
              details: { status },
            },
          },
    };
  }

  const parsedOk = z
    .object({
      roomId: z.string(),
      phase: z.string(),
      playerCount: z.number(),
      playerCounts: z.object({
        players: z.number(),
        spectators: z.number(),
        bots: z.number(),
      }),
      settings: z.record(z.unknown()),
    })
    .safeParse(body);

  if (!parsedOk.success) {
    return {
      ok: false,
      status,
      error: {
        error: {
          code: "INTERNAL_ERROR",
          message: "Invalid PartyKit state response",
          details: parsedOk.error.flatten(),
        },
      },
    };
  }

  return {
    ok: true,
    data: parsedOk.data,
  };
}
