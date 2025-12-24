"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import NumberBingoCard from "@/components/NumberBingoCard";
import { generateCardNumbers } from "@/lib/bingo";
import Image from 'next/image';
import {
  clearGameState,
  fetchGameState,
  saveGameState,
  type GameState,
  type WinnerClaim,
} from "@/lib/supabaseGame";
import {
  PATTERN_LABELS,
  PATTERN_INDEXES,
} from "@/lib/patterns";
import PatternBuilder from "@/components/PatternBuilder";
import { toast } from "sonner";
import { verifyBingoWin } from "@/lib/bingoVerification";
import { recordBingoCall } from "@/lib/supabaseBingo";

function getBingoLetter(number: number): string {
  if (number <= 15) return "B";
  if (number <= 30) return "I";
  if (number <= 45) return "N";
  if (number <= 60) return "G";
  return "O";
}

function getBallColor(letter: string): string {
  switch (letter) {
    case "B":
      return "bg-red-500";
    case "I":
      return "bg-blue-500";
    case "N":
      return "bg-green-500";
    case "G":
      return "bg-yellow-500";
    case "O":
      return "bg-purple-500";
    default:
      return "bg-gray-500";
  }
}

function useClientId(): string {
  const key = "bingo_client_id";
  const [id] = useState(() => {
    if (typeof window === "undefined") return "server";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const newId = crypto.randomUUID();
    localStorage.setItem(key, newId);
    return newId;
  });
  return id;
}

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const isHost = searchParams.get("host") === "1";
  const clientId = useClientId();

  const [game, setGame] = useState<GameState>({
    drawnBalls: [],
    currentBall: null,
    pattern: null,
    customPattern: null,
    winners: [],
    isDrawing: false,
    resetCount: 0,
  });
  const [cardNumbers, setCardNumbers] = useState<(number | null)[] | null>(
    null,
  );
  const [onlineCount, setOnlineCount] = useState(1);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameRef = useRef<GameState>({
    drawnBalls: [],
    currentBall: null,
    pattern: null,
    customPattern: null,
    winners: [],
    isDrawing: false,
    resetCount: 0,
  });
  const [username, setUsername] = useState("");
  const [cardVersion, setCardVersion] = useState(0);
  const [players, setPlayers] = useState<string[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [displayedWinnerIds, setDisplayedWinnerIds] = useState<Set<string>>(new Set());
  const [punchVersion, setPunchVersion] = useState(0);

  const roomChannelName = useMemo(() => `bingo:room-${roomId}`, [roomId]);

  // Keep a ref of the latest game to avoid stale closures in handlers
  useEffect(() => {
    gameRef.current = {
      ...game,
      winners: game.winners || [],
    };
  }, [game]);

  // Load displayed winners from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`displayed_winners:${roomId}`);
    if (saved) {
      try {
        setDisplayedWinnerIds(new Set(JSON.parse(saved)));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [roomId]);

  // Clear claim status when game is reset
  useEffect(() => {
    if (isHost || typeof window === "undefined") return;

    const claimKey = `bingo_claimed:${roomId}:${clientId}:${cardVersion}`;
    const lastResetKey = `last_reset:${roomId}:${clientId}`;

    const savedResetCount = localStorage.getItem(lastResetKey);
    const currentResetCount = game.resetCount || 0;

    if (savedResetCount !== String(currentResetCount)) {
      // Reset count changed - clear claim status
      localStorage.removeItem(claimKey);
      localStorage.setItem(lastResetKey, String(currentResetCount));
      // Trigger re-check
      setPunchVersion((v) => v + 1);
    }
  }, [game.resetCount, roomId, clientId, cardVersion, isHost]);

  // Player-side animation when host is drawing
  useEffect(() => {
    if (isHost || !game.isDrawing) return;

    let steps = 0;
    const maxSteps = 20;
    let timeoutId: NodeJS.Timeout;
    const delayMs = 100;

    const spin = () => {
      // Generate random ball for animation
      const randomBall = Math.floor(Math.random() * 75) + 1;

      // Update local display only (don't broadcast)
      setGame((prev) => ({
        ...prev,
        currentBall: randomBall,
      }));

      steps++;
      if (steps < maxSteps && game.isDrawing) {
        timeoutId = setTimeout(spin, delayMs);
      }
    };

    timeoutId = setTimeout(spin, delayMs);
    return () => clearTimeout(timeoutId);
  }, [game.isDrawing, isHost]);

  // Channel setup
  useEffect(() => {
    const channel = supabase.channel(roomChannelName, {
      config: {
        broadcast: { self: false },
        presence: { key: clientId },
      },
    });

    channel
      .on(
        "broadcast",
        { event: "state" },
        ({ payload }: { payload: GameState }) => {
          const next = payload as GameState;
          setGame(next);
        },
      )
      .on(
        "broadcast",
        { event: "request_state" },
        async () => {
          if (!isHost) return;
          // Reply with authoritative state
          channel.send({
            type: "broadcast",
            event: "state",
            payload: gameRef.current,
          });
        },
      )
      .on(
        "broadcast",
        { event: "claim_bingo" },
        ({
          payload,
        }: {
          payload: Omit<WinnerClaim, "id" | "status">;
        }) => {
          if (!isHost) return;

          // Ensure winners array exists
          if (!gameRef.current.winners) {
            gameRef.current.winners = [];
          }

          // Check for duplicate claim
          const isDuplicate = gameRef.current.winners.some(
            (w) =>
              w.clientId === payload.clientId &&
              w.cardVersion === payload.cardVersion,
          );
          if (isDuplicate) return;

          // Host-side verification (double-check)
          const verified = verifyBingoWin({
            cardNumbers: payload.cardNumbers,
            punchedCells: Array(25)
              .fill(false)
              .map((_, i) => payload.punchedIndexes.includes(i)),
            drawnBalls: gameRef.current.drawnBalls,
            pattern: payload.pattern,
            customPattern: payload.customPattern ?? null,
          });

          if (!verified.isValid) {
            console.warn("Invalid claim rejected:", verified.reason);
            return;
          }

          // Add to winners with pending status
          const newClaim: WinnerClaim = {
            id: crypto.randomUUID(),
            ...payload,
            status: "pending",
          };

          announceState({
            ...gameRef.current,
            winners: [...gameRef.current.winners, newClaim],
          });
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        const total = Object.values(state).reduce(
          (acc, arr) => acc + arr.length,
          0,
        );
        setOnlineCount(total);
        const names: string[] = [];
        Object.values(state).forEach((arr) => {
          for (const entry of arr as Array<any>) {
            if (entry?.role === "player" && entry?.username)
              names.push(String(entry.username));
          }
        });
        setPlayers(names);
        // Host proactively shares state when someone joins
        if (isHost) {
          channel.send({
            type: "broadcast",
            event: "state",
            payload: gameRef.current,
          });
        }
      })
      .on("presence", { event: "join" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        const names: string[] = [];
        Object.values(state).forEach((arr) => {
          for (const entry of arr as Array<any>) {
            if (entry?.role === "player" && entry?.username)
              names.push(String(entry.username));
          }
        });
        setPlayers(names);
      })
      .on("presence", { event: "leave" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        const names: string[] = [];
        Object.values(state).forEach((arr) => {
          for (const entry of arr as Array<any>) {
            if (entry?.role === "player" && entry?.username)
              names.push(String(entry.username));
          }
        });
        setPlayers(names);
      });

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        // Load username from localStorage for presence
        const savedName = localStorage.getItem("bingo_username") || "";
        setUsername(isHost ? "" : savedName);
        await channel.track({
          online_at: new Date().toISOString(),
          role: isHost ? "host" : "player",
          username: isHost ? undefined : savedName,
        });
        setIsSubscribed(true);
        // Player requests latest state immediately
        if (!isHost) {
          channel.send({
            type: "broadcast",
            event: "request_state",
            payload: { requester: clientId },
          });
        } else {
          // Host announces initial state
          channel.send({
            type: "broadcast",
            event: "state",
            payload: gameRef.current,
          });
        }
      }
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomChannelName, clientId, isHost]);

  // Persist host game state locally per room and load on mount
  useEffect(() => {
    if (!isHost) return;
    try {
      // Prefer server state
      fetchGameState(String(roomId)).then((server) => {
        if (server) {
          setGame({
            ...server,
            winners: server.winners || [],
          });
          return;
        }
      });
      const saved = localStorage.getItem(`game:${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        if (parsed && Array.isArray(parsed.drawnBalls)) {
          setGame({
            ...parsed,
            winners: parsed.winners || [],
          });
        }
      }
    } catch {}
  }, [roomId, isHost]);

  useEffect(() => {
    if (!isHost) return;
    try {
      localStorage.setItem(`game:${roomId}`, JSON.stringify(game));
    } catch {}
  }, [game, roomId, isHost]);

  // After subscription, broadcast once using current state
  useEffect(() => {
    if (!isHost || !isSubscribed) return;
    channelRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: gameRef.current,
    });
  }, [isHost, isSubscribed]);

  // Generate stable per-player card based on room + client
  useEffect(() => {
    if (!roomId) return;
    // Load card version per room/player
    try {
      const savedVer = localStorage.getItem(
        `card_version:${roomId}:${clientId}`,
      );
      if (savedVer) setCardVersion(parseInt(savedVer) || 0);
    } catch {}
    const seed = `${roomId}:${clientId}:${cardVersion}`;
    setCardNumbers(generateCardNumbers(seed));
  }, [roomId, clientId, cardVersion]);

  const refreshCard = useCallback(() => {
    if (gameRef.current.drawnBalls.length > 0) {
      toast("Card refresh is locked once drawing starts.");
      return;
    }
    const next = cardVersion + 1;
    setCardVersion(next);
    try {
      localStorage.setItem(`card_version:${roomId}:${clientId}`, String(next));
    } catch {}
    const seed = `${roomId}:${clientId}:${next}`;
    setCardNumbers(generateCardNumbers(seed));
  }, [isHost, cardVersion, roomId, clientId]);

  const saveUsername = useCallback(() => {
    if (isHost) return;
    const trimmed = (username || "").trim();
    try {
      localStorage.setItem("bingo_username", trimmed);
    } catch {}
    if (channelRef.current) {
      channelRef.current.track({
        online_at: new Date().toISOString(),
        role: "player",
        username: trimmed,
      });
    }
  }, [isHost, username]);

  // Check if player has already claimed Bingo
  const hasClaimedBingo = useMemo(() => {
    if (typeof window === "undefined" || isHost) return false;
    const claimed = localStorage.getItem(
      `bingo_claimed:${roomId}:${clientId}:${cardVersion}`,
    );
    return claimed === "true";
  }, [roomId, clientId, cardVersion, isHost]);

  // Check if Bingo can be claimed
  const canClaimBingo = useMemo(() => {
    if (typeof window === "undefined" || !cardNumbers || hasClaimedBingo || !game.pattern || game.pattern === "none") {
      return false;
    }

    // Get punched state from localStorage
    const saved = localStorage.getItem(
      `punched:${roomId}:${clientId}:${cardVersion}`,
    );
    if (!saved) return false;

    try {
      const punched = JSON.parse(saved) as boolean[];
      const result = verifyBingoWin({
        cardNumbers,
        punchedCells: punched,
        drawnBalls: game.drawnBalls,
        pattern: game.pattern,
        customPattern: game.customPattern ?? null,
      });
      return result.isValid;
    } catch {
      return false;
    }
  }, [
    cardNumbers,
    hasClaimedBingo,
    game.pattern,
    game.customPattern,
    game.drawnBalls,
    roomId,
    clientId,
    cardVersion,
    punchVersion, // Re-check when punches change
  ]);

  const handleClaimBingo = useCallback(() => {
    if (!cardNumbers || hasClaimedBingo || !canClaimBingo) return;

    // Get punched state
    const saved = localStorage.getItem(
      `punched:${roomId}:${clientId}:${cardVersion}`,
    );
    if (!saved) return;

    try {
      const punched = JSON.parse(saved) as boolean[];

      // Create claim data
      const claimData: Omit<WinnerClaim, "id" | "status"> = {
        username,
        clientId,
        cardVersion,
        claimedAt: new Date().toISOString(),
        ballNumber:
          game.currentBall || game.drawnBalls[game.drawnBalls.length - 1] || 0,
        pattern: game.pattern ?? null,
        customPattern: game.customPattern ?? null,
        cardNumbers,
        punchedIndexes: punched
          .map((p, i) => (p ? i : -1))
          .filter((i) => i >= 0),
      };

      // Mark as claimed (prevents multiple claims)
      localStorage.setItem(
        `bingo_claimed:${roomId}:${clientId}:${cardVersion}`,
        "true",
      );

      // Force re-check to disable button immediately
      setPunchVersion((v) => v + 1);

      // Broadcast claim
      channelRef.current?.send({
        type: "broadcast",
        event: "claim_bingo",
        payload: claimData,
      });

      toast.success("BINGO! Claim submitted!");
    } catch (err) {
      console.error("Failed to claim bingo:", err);
      toast.error("Failed to submit claim");
    }
  }, [
    cardNumbers,
    hasClaimedBingo,
    canClaimBingo,
    roomId,
    clientId,
    cardVersion,
    username,
    game.currentBall,
    game.drawnBalls,
    game.pattern,
    game.customPattern,
  ]);

  const announceState = useCallback(
    (next: GameState) => {
      setGame(next);
      gameRef.current = next;
      channelRef.current?.send({
        type: "broadcast",
        event: "state",
        payload: next,
      });
      // Persist to server best-effort
      saveGameState(String(roomId), next);
    },
    [roomId],
  );

  const drawNewBall = useCallback(() => {
    if (!isHost || gameRef.current.isDrawing) return;
    const base = gameRef.current;
    if (base.drawnBalls.length === 75) return;

    // Announce drawing started
    announceState({
      ...gameRef.current,
      isDrawing: true,
    });

    // Add delay between animation frames for slower animation
    let steps = 0;
    const maxSteps = 20;
    let timeoutId: NodeJS.Timeout;
    let lastUpdate = Date.now();
    const delayMs = 100; // 100ms delay between each spin

    const spin = () => {
      const now = Date.now();
      if (now - lastUpdate < delayMs) {
        timeoutId = setTimeout(spin, delayMs - (now - lastUpdate));
        return;
      }
      lastUpdate = now;

      let randomBall: number;
      do {
        randomBall = Math.floor(Math.random() * 75) + 1;
      } while (gameRef.current.drawnBalls.includes(randomBall));

      // Update local display for host animation
      setGame((prev) => ({
        ...prev,
        currentBall: randomBall,
      }));

      steps++;
      if (steps > maxSteps) {
        const final: GameState = {
          drawnBalls: [...gameRef.current.drawnBalls, randomBall],
          currentBall: randomBall,
          pattern: gameRef.current.pattern ?? null,
          customPattern: gameRef.current.customPattern ?? null,
          winners: gameRef.current.winners || [],
          isDrawing: false,
        };
        announceState(final);
        return;
      }
      timeoutId = setTimeout(spin, delayMs);
    };
    timeoutId = setTimeout(spin, delayMs);
    return () => clearTimeout(timeoutId);
  }, [isHost, announceState]);

  const handleApproveClaim = useCallback(
    (claimId: string) => {
      if (!isHost) return;

      const claim = (gameRef.current.winners || []).find((w) => w.id === claimId);
      if (!claim) return;

      const updatedWinners = (gameRef.current.winners || []).map((w) =>
        w.id === claimId ? { ...w, status: "approved" as const } : w,
      );

      announceState({ ...gameRef.current, winners: updatedWinners });

      recordBingoCall({
        roomId: String(roomId),
        username: claim.username,
        cardVersion: claim.cardVersion,
        pattern: claim.pattern,
      });

      toast.success(`Approved ${claim.username}'s Bingo!`);
    },
    [isHost, roomId, announceState],
  );

  const handleRejectClaim = useCallback(
    (claimId: string) => {
      if (!isHost) return;

      const claim = (gameRef.current.winners || []).find((w) => w.id === claimId);
      if (!claim) return;

      const updatedWinners = (gameRef.current.winners || []).map((w) =>
        w.id === claimId ? { ...w, status: "rejected" as const } : w,
      );

      announceState({ ...gameRef.current, winners: updatedWinners });

      toast.error(`Rejected ${claim.username}'s claim`);
    },
    [isHost, announceState],
  );

  const handleReset = useCallback(() => {
    if (!isHost) return;
    setShowResetConfirm(false);
    announceState({
      drawnBalls: [],
      currentBall: null,
      pattern: gameRef.current.pattern ?? null,
      customPattern: gameRef.current.customPattern ?? null,
      winners: [],
      isDrawing: false,
      resetCount: (gameRef.current.resetCount || 0) + 1,
    });
    try {
      localStorage.removeItem(`game:${roomId}`);
    } catch {}
    clearGameState(String(roomId));
  }, [isHost, announceState, roomId]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/game/${roomId}`;
  }, [roomId]);

  const gameComplete = game.drawnBalls.length === 75;

  // Calculate new winners for modal
  const newWinners = (game.winners || []).filter(
    (w) => !displayedWinnerIds.has(w.id) && w.clientId !== clientId,
  );

  const handleDismissWinners = () => {
    const updated = new Set([
      ...displayedWinnerIds,
      ...newWinners.map((w) => w.id),
    ]);
    setDisplayedWinnerIds(updated);
    localStorage.setItem(
      `displayed_winners:${roomId}`,
      JSON.stringify([...updated]),
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="p-6 max-w-md w-[90%] space-y-1">
            <h2 className="text-2xl font-bold">Reset Game?</h2>
            <p className="text-gray-600">
              This will clear all drawn balls and start a new game. Players will
              keep their current cards.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 font-bold"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReset}
                className="flex-1 font-bold"
                variant="destructive"
              >
                Yes, Reset Game
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Win Notification Modal */}
      {newWinners.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="p-6 max-w-md w-[90%] space-y-4">
            <h2 className="text-2xl font-bold text-center">BINGO!</h2>
            <div className="space-y-2">
              {newWinners.map((winner) => (
                <div key={winner.id} className="flex flex-col gap-8 p-2 items-center justify-center">
                  <div className='flex flex-row gap-2'>
                    <Image src="/shiro.png" alt="Shiro!" width={100} height={100} />
                    <Image src="/nabi.png" alt="Nabi!" width={100} height={100} />
                  </div>

                  <p className='text-2xl text-center'>
                    <strong className='text-green-500'>{winner.username}</strong> has hit Bingo!
                  </p>
                </div>
              ))}
            </div>
            <Button
              onClick={handleDismissWinners}
              className="w-full font-bold"
            >
              OK
            </Button>
          </Card>
        </div>
      )}

      {/* Game Complete Banner */}
      {gameComplete && (
        <div className="mb-6">
          <Card className="p-6 bg-black text-white">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">All Balls Drawn!</h2>
              <p className="text-lg">
                {isHost
                  ? "All 75 balls have been drawn. Verify winners and reset when ready."
                  : "All 75 balls have been drawn. Check your card for a winning pattern!"}
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-row items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Room {roomId}</h1>
          <p className="text-sm text-gray-500">
            {isHost ? "Host" : "Player"} • Online: {onlineCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <Button
              variant="secondary"
              onClick={handleReset}
              className="font-bold"
            >
              Reset
            </Button>
          )}
          <Button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl);
              toast("Link copied to clipboard!");
            }}
            className="font-bold"
          >
            Copy Join Link
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 justify-center">
        <div className="flex flex-col items-center lg:w-fit">
          {!isHost && (
            <div className="w-full max-w-xs mb-6">
              <label className="block text-sm font-medium mb-1">
                Your Name
              </label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveUsername();
                      toast("Username saved!");
                    }
                  }}
                  placeholder="Enter display name"
                />
                <Button
                  onClick={() => {
                    saveUsername();
                    toast("Username saved!");
                  }}
                  variant="default"
                  className="px-4 h-10"
                >
                  Save
                </Button>
              </div>
            </div>
          )}
          {isHost && (
            <div className="flex flex-col items-center w-full max-w-xs mb-6">
              <PatternBuilder
                patternId={game.pattern ?? "none"}
                customIndexes={
                  game.customPattern ??
                  (game.pattern ? PATTERN_INDEXES[game.pattern] : [])
                }
                onChangePatternId={(id) =>
                  announceState({ ...gameRef.current, pattern: id })
                }
                onChangeCustom={(indexes) =>
                  announceState({ ...gameRef.current, customPattern: indexes })
                }
              />

              {/* Host Winners Verification Panel */}
              {(game.winners || []).length > 0 && (
                <Card className="p-4 mb-4 w-full">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    Winners
                    {(game.winners || []).filter((w) => w.status === "pending")
                      .length > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {
                          (game.winners || []).filter((w) => w.status === "pending")
                            .length
                        }{" "}
                        pending
                      </span>
                    )}
                  </h3>
                  <div className="-mt-5 space-y-3 max-h-96 overflow-y-auto">
                    {(game.winners || []).map((winner) => (
                      <div
                        key={winner.id}
                        className={`border rounded p-3 ${
                          winner.status === "approved"
                            ? "bg-green-50 border-green-300"
                            : winner.status === "rejected"
                              ? "bg-red-50 border-red-300"
                              : "bg-yellow-50 border-yellow-300"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold">{winner.username}</p>
                            <p className="text-xs text-gray-600">
                              Ball {winner.ballNumber} •{" "}
                              {PATTERN_LABELS[winner.pattern || "none"]}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              winner.status === "approved"
                                ? "bg-green-200"
                                : winner.status === "rejected"
                                  ? "bg-red-200"
                                  : "bg-yellow-200"
                            }`}
                          >
                            {winner.status}
                          </span>
                        </div>

                        {/* Mini card grid */}
                        <div className="grid grid-cols-5 gap-1 mb-2">
                          {winner.cardNumbers.map((num, idx) => (
                            <div
                              key={idx}
                              className={`text-xs p-1 text-center border ${
                                winner.punchedIndexes.includes(idx)
                                  ? "bg-primary text-white"
                                  : "bg-white"
                              }`}
                            >
                              {num === null ? "F" : num}
                            </div>
                          ))}
                        </div>

                        {winner.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1"
                              onClick={() => handleApproveClaim(winner.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => handleRejectClaim(winner.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {game.drawnBalls.length !== 75 ? (
                <Button
                  size="lg"
                  onClick={drawNewBall}
                  disabled={game.isDrawing || game.drawnBalls.length === 75}
                  className="text-xl px-8 py-6 w-full font-bold"
                >
                  {game.isDrawing ? "Drawing..." : "Draw Ball"}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-lg h-12 w-full font-bold"
                  variant="destructive"
                >
                  Reset Game
                </Button>
              )}
            </div>
          )}

          {game.currentBall ? (
            <div className="relative">
              <div
                className={`${getBallColor(getBingoLetter(game.currentBall))} ${isHost ? "w-[260px] h-[260px]" : "w-[200px] h-[200px]"} rounded-full flex items-center justify-center shadow-lg`}
              >
                <div
                  className={`bg-white ${isHost ? "w-[210px] h-[210px]" : "w-40 h-40"} rounded-full flex flex-col items-center justify-center`}
                >
                  <span
                    className={`${isHost ? "text-7xl" : "text-5xl"} font-bold`}
                  >
                    {getBingoLetter(game.currentBall)}
                  </span>
                  <span
                    className={`${isHost ? "text-8xl" : "text-6xl"} font-bold`}
                  >
                    {game.currentBall}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`${isHost ? "w-[260px] h-[260px]" : "w-[200px] h-[200px]"} rounded-full border-12 border-gray-300 flex items-center justify-center`}
            >
              <span className="text-gray-400 text-xl">No ball drawn</span>
            </div>
          )}
          {!isHost && cardNumbers && (
            <NumberBingoCard
              numbers={cardNumbers}
              drawnBalls={game.drawnBalls}
              interactive={!isHost}
              storageKey={`${roomId}:${clientId}:${cardVersion}`}
              activePattern={game.pattern ?? null}
              customPattern={game.customPattern ?? null}
              onPunchChange={() => setPunchVersion((v) => v + 1)}
            />
          )}
          {!isHost && (
            <>
              <Button
                onClick={refreshCard}
                variant="default"
                className="w-[70%] lg:w-full mt-3"
                disabled={game.drawnBalls.length > 0}
                title={
                  game.drawnBalls.length > 0
                    ? "Disabled after first draw"
                    : undefined
                }
              >
                Refresh Card
              </Button>
              <Button
                onClick={handleClaimBingo}
                variant="default"
                className="w-[70%] lg:w-full mt-3 font-bold text-lg"
                disabled={!canClaimBingo}
                title={
                  hasClaimedBingo
                    ? "You've already claimed Bingo!"
                    : !canClaimBingo
                      ? "Complete the pattern to claim Bingo"
                      : "Click to claim Bingo!"
                }
              >
                {hasClaimedBingo ? "Bingo Claimed!" : "Claim Bingo"}
              </Button>
            </>
          )}
        </div>

        <div className="lg:w-2/3">
          <Card className="p-4">
            {/* Compact list of called balls at the bottom */}
            <div className="space-y-3">
              <h3 className="font-semibold">Called Balls</h3>
              <div className="flex flex-wrap gap-2">
                {game.drawnBalls
                  .slice()
                  .sort((a, b) => a - b)
                  .map((ball) => (
                    <div
                      key={ball}
                      className={`px-2 py-1 rounded-full text-sm font-bold border ${getBallColor(getBingoLetter(ball))} text-white`}
                    >
                      {getBingoLetter(ball)} {ball}
                    </div>
                  ))}
                {game.drawnBalls.length === 0 && (
                  <span className="text-gray-500 text-sm">No calls yet</span>
                )}
              </div>
            </div>
            {isHost && (
              <div className="space-y-2 mt-6">
                <h3 className="font-semibold">Players</h3>
                <ul className="list-disc pl-5 text-sm">
                  {players.length === 0 && (
                    <li className="text-gray-500">No players yet</li>
                  )}
                  {players.map((p, i) => (
                    <li key={`${p}-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
