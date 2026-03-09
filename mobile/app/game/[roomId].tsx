import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  Share,
  ActivityIndicator,
  Pressable,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Crypto from "expo-crypto"
import * as Clipboard from "expo-clipboard"
import Toast from "react-native-toast-message"

import { supabase } from "../../lib/supabaseClient"
import { generateCardNumbers } from "../../lib/bingo"
import {
  clearGameState,
  fetchGameState,
  saveGameState,
  type GameState,
  type WinnerClaim,
} from "../../lib/supabaseGame"
import { PATTERN_LABELS, PATTERN_INDEXES } from "../../lib/patterns"
import { verifyBingoWin } from "../../lib/bingoVerification"
import { recordBingoCall } from "../../lib/supabaseBingo"
import { storage } from "../../lib/storage"
import NumberBingoCard from "../../components/NumberBingoCard"
import PatternBuilder from "../../components/PatternBuilder"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBingoLetter(n: number): string {
  if (n <= 15) return "B"
  if (n <= 30) return "I"
  if (n <= 45) return "N"
  if (n <= 60) return "G"
  return "O"
}

const BALL_COLORS: Record<string, string> = {
  B: "#ef4444",
  I: "#3b82f6",
  N: "#22c55e",
  G: "#eab308",
  O: "#a855f7",
}

function ballColor(n: number): string {
  return BALL_COLORS[getBingoLetter(n)] ?? "#6b7280"
}

// ─── useClientId ──────────────────────────────────────────────────────────────

function useClientId(): string | null {
  const [clientId, setClientId] = useState<string | null>(null)
  useEffect(() => {
    storage.getItem("bingo_client_id").then((id) => {
      if (id) {
        setClientId(id)
      } else {
        const newId = Crypto.randomUUID()
        storage.setItem("bingo_client_id", newId)
        setClientId(newId)
      }
    })
  }, [])
  return clientId
}

// ─── GameRoomScreen ───────────────────────────────────────────────────────────

const INITIAL_GAME: GameState = {
  drawnBalls: [],
  currentBall: null,
  pattern: null,
  customPattern: null,
  winners: [],
  isDrawing: false,
  resetCount: 0,
}

export default function GameRoomScreen() {
  const { roomId, host } = useLocalSearchParams<{ roomId: string; host?: string }>()
  const isHost = host === "1"
  const router = useRouter()
  const clientId = useClientId()

  const [game, setGame] = useState<GameState>(INITIAL_GAME)
  const gameRef = useRef<GameState>(INITIAL_GAME)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const [cardNumbers, setCardNumbers] = useState<(number | null)[] | null>(null)
  const [punched, setPunched] = useState<boolean[]>(new Array(25).fill(false))
  const [onlineCount, setOnlineCount] = useState(1)
  const [players, setPlayers] = useState<string[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [username, setUsername] = useState("")
  const [cardVersion, setCardVersion] = useState(0)
  const [hasClaimed, setHasClaimed] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [displayedWinnerIds, setDisplayedWinnerIds] = useState<Set<string>>(new Set())

  const roomChannelName = useMemo(() => `bingo:room-${roomId}`, [roomId])

  // Keep gameRef in sync
  useEffect(() => {
    gameRef.current = { ...game, winners: game.winners ?? [] }
  }, [game])

  // ─── Load persisted data ────────────────────────────────────────────────────

  useEffect(() => {
    if (!clientId || !roomId) return
    // Load username
    storage.getItem("bingo_username").then((saved) => {
      if (saved) setUsername(isHost ? "" : saved)
    })
    // Load displayed winners
    storage.getItem(`displayed_winners:${roomId}`).then((saved) => {
      if (saved) {
        try { setDisplayedWinnerIds(new Set(JSON.parse(saved))) } catch {}
      }
    })
    // Load card version
    storage.getItem(`card_version:${roomId}:${clientId}`).then((saved) => {
      const ver = parseInt(saved ?? "0") || 0
      setCardVersion(ver)
    })
    // Load claimed status
    storage.getItem(`bingo_claimed:${roomId}:${clientId}:${cardVersion}`).then((saved) => {
      setHasClaimed(saved === "true")
    })
  }, [clientId, roomId, isHost, cardVersion])

  // Load punched state from storage when card is ready
  useEffect(() => {
    if (!clientId || !roomId) return
    const key = `punched:${roomId}:${clientId}:${cardVersion}`
    storage.getItem(key).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as boolean[]
          if (Array.isArray(parsed) && parsed.length === 25) {
            const next = [...parsed]
            next[12] = true // FREE always punched
            setPunched(next)
            return
          }
        } catch {}
      }
      const fresh = new Array(25).fill(false)
      fresh[12] = true
      setPunched(fresh)
    })
  }, [clientId, roomId, cardVersion])

  // Generate card numbers
  useEffect(() => {
    if (!roomId || !clientId) return
    const seed = `${roomId}:${clientId}:${cardVersion}`
    setCardNumbers(generateCardNumbers(seed))
  }, [roomId, clientId, cardVersion])

  // Host: load game state from server on mount
  useEffect(() => {
    if (!isHost || !roomId) return
    fetchGameState(String(roomId)).then((server) => {
      if (server) setGame({ ...server, winners: server.winners ?? [] })
    })
    storage.getItem(`game:${roomId}`).then((saved) => {
      if (!saved) return
      try {
        const parsed = JSON.parse(saved) as GameState
        if (parsed && Array.isArray(parsed.drawnBalls)) {
          setGame((prev) =>
            prev.drawnBalls.length === 0
              ? { ...parsed, winners: parsed.winners ?? [] }
              : prev
          )
        }
      } catch {}
    })
  }, [isHost, roomId])

  // Host: persist game state locally
  useEffect(() => {
    if (!isHost || !roomId) return
    storage.setItem(`game:${roomId}`, JSON.stringify(game))
  }, [game, isHost, roomId])

  // Clear claimed state when game resets
  useEffect(() => {
    if (isHost || !clientId || !roomId) return
    const claimKey = `bingo_claimed:${roomId}:${clientId}:${cardVersion}`
    const resetKey = `last_reset:${roomId}:${clientId}`
    storage.getItem(resetKey).then((savedReset) => {
      const current = String(game.resetCount ?? 0)
      if (savedReset !== current) {
        storage.removeItem(claimKey)
        storage.setItem(resetKey, current)
        setHasClaimed(false)
      }
    })
  }, [game.resetCount, clientId, roomId, cardVersion, isHost])

  // Player-side slot-machine animation when host is drawing
  useEffect(() => {
    if (isHost || !game.isDrawing) return
    let steps = 0
    const maxSteps = 20
    let tid: ReturnType<typeof setTimeout>
    const spin = () => {
      setGame((prev) => ({ ...prev, currentBall: Math.floor(Math.random() * 75) + 1 }))
      steps++
      if (steps < maxSteps) tid = setTimeout(spin, 100)
    }
    tid = setTimeout(spin, 100)
    return () => clearTimeout(tid)
  }, [game.isDrawing, isHost])

  // ─── Channel setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clientId) return

    const channel = supabase.channel(roomChannelName, {
      config: {
        broadcast: { self: false },
        presence: { key: clientId },
      },
    })

    channel
      .on("broadcast", { event: "state" }, ({ payload }: { payload: GameState }) => {
        setGame(payload as GameState)
      })
      .on("broadcast", { event: "request_state" }, async () => {
        if (!isHost) return
        channel.send({ type: "broadcast", event: "state", payload: gameRef.current })
      })
      .on(
        "broadcast",
        { event: "claim_bingo" },
        ({ payload }: { payload: Omit<WinnerClaim, "id" | "status"> }) => {
          if (!isHost) return

          const winners = gameRef.current.winners ?? []
          const isDuplicate = winners.some(
            (w) => w.clientId === payload.clientId && w.cardVersion === payload.cardVersion,
          )
          if (isDuplicate) return

          const verified = verifyBingoWin({
            cardNumbers: payload.cardNumbers,
            punchedCells: Array(25)
              .fill(false)
              .map((_, i) => payload.punchedIndexes.includes(i)),
            drawnBalls: gameRef.current.drawnBalls,
            pattern: payload.pattern,
            customPattern: payload.customPattern ?? null,
          })
          if (!verified.isValid) return

          const newClaim: WinnerClaim = {
            id: Crypto.randomUUID(),
            ...payload,
            status: "pending",
          }
          announceState({ ...gameRef.current, winners: [...winners, newClaim] })
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>
        const total = Object.values(state).reduce((acc, arr) => acc + arr.length, 0)
        setOnlineCount(total)
        const names: string[] = []
        Object.values(state).forEach((arr) => {
          for (const entry of arr as Array<any>) {
            if (entry?.role === "player" && entry?.username) names.push(String(entry.username))
          }
        })
        setPlayers(names)
        if (isHost) {
          channel.send({ type: "broadcast", event: "state", payload: gameRef.current })
        }
      })
      .on("presence", { event: "join" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>
        const names: string[] = []
        Object.values(state).forEach((arr) => {
          for (const entry of arr as Array<any>) {
            if (entry?.role === "player" && entry?.username) names.push(String(entry.username))
          }
        })
        setPlayers(names)
      })
      .on("presence", { event: "leave" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>
        const names: string[] = []
        Object.values(state).forEach((arr) => {
          for (const entry of arr as Array<any>) {
            if (entry?.role === "player" && entry?.username) names.push(String(entry.username))
          }
        })
        setPlayers(names)
      })

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const savedName = await storage.getItem("bingo_username") ?? ""
        setUsername(isHost ? "" : savedName)
        await channel.track({
          online_at: new Date().toISOString(),
          role: isHost ? "host" : "player",
          username: isHost ? undefined : savedName,
        })
        setIsSubscribed(true)
        if (!isHost) {
          channel.send({
            type: "broadcast",
            event: "request_state",
            payload: { requester: clientId },
          })
        } else {
          channel.send({ type: "broadcast", event: "state", payload: gameRef.current })
        }
      }
    })

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomChannelName, clientId, isHost])

  // Broadcast state once subscribed (host)
  useEffect(() => {
    if (!isHost || !isSubscribed) return
    channelRef.current?.send({ type: "broadcast", event: "state", payload: gameRef.current })
  }, [isHost, isSubscribed])

  // ─── Game actions ───────────────────────────────────────────────────────────

  const announceState = useCallback(
    (next: GameState) => {
      setGame(next)
      gameRef.current = next
      channelRef.current?.send({ type: "broadcast", event: "state", payload: next })
      saveGameState(String(roomId), next)
    },
    [roomId],
  )

  const drawNewBall = useCallback(() => {
    if (!isHost || gameRef.current.isDrawing) return
    if (gameRef.current.drawnBalls.length >= 75) return

    announceState({ ...gameRef.current, isDrawing: true })

    let steps = 0
    const maxSteps = 20
    let lastUpdate = Date.now()
    let tid: ReturnType<typeof setTimeout>

    const spin = () => {
      const now = Date.now()
      if (now - lastUpdate < 100) {
        tid = setTimeout(spin, 100 - (now - lastUpdate))
        return
      }
      lastUpdate = now

      let ball: number
      do {
        ball = Math.floor(Math.random() * 75) + 1
      } while (gameRef.current.drawnBalls.includes(ball))

      setGame((prev) => ({ ...prev, currentBall: ball }))
      steps++

      if (steps > maxSteps) {
        const final: GameState = {
          drawnBalls: [...gameRef.current.drawnBalls, ball],
          currentBall: ball,
          pattern: gameRef.current.pattern ?? null,
          customPattern: gameRef.current.customPattern ?? null,
          winners: gameRef.current.winners ?? [],
          isDrawing: false,
        }
        announceState(final)
        return
      }
      tid = setTimeout(spin, 100)
    }
    tid = setTimeout(spin, 100)
  }, [isHost, announceState])

  const handleCellToggle = useCallback(
    (_idx: number, newPunched: boolean[]) => {
      const next = [...newPunched]
      next[12] = true // keep FREE
      setPunched(next)
      if (clientId && roomId) {
        storage.setItem(
          `punched:${roomId}:${clientId}:${cardVersion}`,
          JSON.stringify(next),
        )
      }
    },
    [clientId, roomId, cardVersion],
  )

  const refreshCard = useCallback(() => {
    if (gameRef.current.drawnBalls.length > 0) {
      Toast.show({ type: "info", text1: "Card is locked once drawing starts." })
      return
    }
    const next = cardVersion + 1
    setCardVersion(next)
    const fresh = new Array(25).fill(false)
    fresh[12] = true
    setPunched(fresh)
    if (clientId && roomId) {
      storage.setItem(`card_version:${roomId}:${clientId}`, String(next))
    }
  }, [cardVersion, clientId, roomId])

  const saveUsernameToPresence = useCallback(() => {
    const trimmed = username.trim()
    storage.setItem("bingo_username", trimmed)
    channelRef.current?.track({
      online_at: new Date().toISOString(),
      role: "player",
      username: trimmed,
    })
    Toast.show({ type: "success", text1: "Username saved!" })
  }, [username])

  const canClaimBingo = useMemo(() => {
    if (!cardNumbers || hasClaimed || !game.pattern || game.pattern === "none") return false
    return verifyBingoWin({
      cardNumbers,
      punchedCells: punched,
      drawnBalls: game.drawnBalls,
      pattern: game.pattern,
      customPattern: game.customPattern ?? null,
    }).isValid
  }, [cardNumbers, hasClaimed, game.pattern, game.customPattern, game.drawnBalls, punched])

  const handleClaimBingo = useCallback(() => {
    if (!cardNumbers || hasClaimed || !canClaimBingo || !clientId) return

    const claimData: Omit<WinnerClaim, "id" | "status"> = {
      username,
      clientId,
      cardVersion,
      claimedAt: new Date().toISOString(),
      ballNumber: game.currentBall ?? game.drawnBalls[game.drawnBalls.length - 1] ?? 0,
      pattern: game.pattern ?? null,
      customPattern: game.customPattern ?? null,
      cardNumbers,
      punchedIndexes: punched.map((p, i) => (p ? i : -1)).filter((i) => i >= 0),
    }

    storage.setItem(`bingo_claimed:${roomId}:${clientId}:${cardVersion}`, "true")
    setHasClaimed(true)

    channelRef.current?.send({
      type: "broadcast",
      event: "claim_bingo",
      payload: claimData,
    })

    Toast.show({ type: "success", text1: "BINGO!", text2: "Claim submitted to host!" })
  }, [
    cardNumbers, hasClaimed, canClaimBingo, clientId, username, cardVersion,
    game.currentBall, game.drawnBalls, game.pattern, game.customPattern,
    punched, roomId,
  ])

  const handleApproveClaim = useCallback(
    (claimId: string) => {
      if (!isHost) return
      const claim = (gameRef.current.winners ?? []).find((w) => w.id === claimId)
      if (!claim) return
      const updated = (gameRef.current.winners ?? []).map((w) =>
        w.id === claimId ? { ...w, status: "approved" as const } : w,
      )
      announceState({ ...gameRef.current, winners: updated })
      recordBingoCall({
        roomId: String(roomId),
        username: claim.username,
        cardVersion: claim.cardVersion,
        pattern: claim.pattern,
      })
      Toast.show({ type: "success", text1: `Approved ${claim.username}'s Bingo!` })
    },
    [isHost, roomId, announceState],
  )

  const handleRejectClaim = useCallback(
    (claimId: string) => {
      if (!isHost) return
      const claim = (gameRef.current.winners ?? []).find((w) => w.id === claimId)
      if (!claim) return
      const updated = (gameRef.current.winners ?? []).map((w) =>
        w.id === claimId ? { ...w, status: "rejected" as const } : w,
      )
      announceState({ ...gameRef.current, winners: updated })
      Toast.show({ type: "error", text1: `Rejected ${claim.username}'s claim` })
    },
    [isHost, announceState],
  )

  const handleReset = useCallback(() => {
    if (!isHost) return
    setShowResetConfirm(false)
    const freshPunched = new Array(25).fill(false)
    freshPunched[12] = true
    announceState({
      drawnBalls: [],
      currentBall: null,
      pattern: gameRef.current.pattern ?? null,
      customPattern: gameRef.current.customPattern ?? null,
      winners: [],
      isDrawing: false,
      resetCount: (gameRef.current.resetCount ?? 0) + 1,
    })
    if (roomId) {
      storage.removeItem(`game:${roomId}`)
      clearGameState(String(roomId))
    }
  }, [isHost, announceState, roomId])

  const handleShareRoom = useCallback(async () => {
    const roomCode = String(roomId)
    try {
      await Clipboard.setStringAsync(roomCode)
      Toast.show({ type: "success", text1: "Room ID copied!", text2: roomCode })
    } catch {
      Share.share({ message: `Join my 25 Bingo game! Room ID: ${roomCode}` })
    }
  }, [roomId])

  // ─── Derived state ──────────────────────────────────────────────────────────

  const gameComplete = game.drawnBalls.length === 75
  const newWinners = (game.winners ?? []).filter(
    (w) => !displayedWinnerIds.has(w.id) && w.clientId !== clientId,
  )

  const handleDismissWinners = () => {
    const updated = new Set([...displayedWinnerIds, ...newWinners.map((w) => w.id)])
    setDisplayedWinnerIds(updated)
    storage.setItem(`displayed_winners:${roomId}`, JSON.stringify([...updated]))
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!clientId) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  const currentLetter = game.currentBall ? getBingoLetter(game.currentBall) : null
  const currentColor = game.currentBall ? ballColor(game.currentBall) : "#d1d5db"

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Reset confirmation modal ─────────────────────────────────────── */}
      <Modal visible={showResetConfirm} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowResetConfirm(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Game?</Text>
            <Text style={styles.modalDesc}>
              This will clear all drawn balls. Players keep their cards.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnOutline]}
                onPress={() => setShowResetConfirm(false)}
              >
                <Text style={styles.modalBtnTextOutline}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDestructive]}
                onPress={handleReset}
              >
                <Text style={styles.modalBtnTextWhite}>Yes, Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── New winners modal ────────────────────────────────────────────── */}
      <Modal visible={newWinners.length > 0} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={handleDismissWinners}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { fontSize: 28 }]}>BINGO!</Text>
            {newWinners.map((w) => (
              <Text key={w.id} style={styles.winnerName}>
                <Text style={{ color: "#22c55e", fontWeight: "bold" }}>{w.username}</Text>
                {" has hit Bingo!"}
              </Text>
            ))}
            <TouchableOpacity style={[styles.primaryButton, { marginTop: 20 }]} onPress={handleDismissWinners}>
              <Text style={styles.primaryButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.roomTitle}>Room {roomId}</Text>
            <Text style={styles.roomMeta}>
              {isHost ? "Host" : "Player"} · {onlineCount} online
            </Text>
          </View>
          <View style={styles.headerActions}>
            {isHost && (
              <TouchableOpacity
                style={[styles.outlineButton, { marginRight: 8 }]}
                onPress={() => setShowResetConfirm(true)}
              >
                <Text style={styles.outlineButtonText}>Reset</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.outlineButton} onPress={handleShareRoom}>
              <Text style={styles.outlineButtonText}>Share ID</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── All balls drawn banner ────────────────────────────────────── */}
        {gameComplete && (
          <View style={styles.completeBanner}>
            <Text style={styles.completeBannerTitle}>All Balls Drawn!</Text>
            <Text style={styles.completeBannerDesc}>
              {isHost
                ? "Verify winners and reset when ready."
                : "Check your card for a winning pattern!"}
            </Text>
          </View>
        )}

        {/* ── Pattern builder (host only) ───────────────────────────────── */}
        {isHost && (
          <View style={styles.section}>
            <PatternBuilder
              patternId={game.pattern ?? "none"}
              customIndexes={
                game.customPattern ?? (game.pattern ? PATTERN_INDEXES[game.pattern] : [])
              }
              onChangePatternId={(id) => announceState({ ...gameRef.current, pattern: id })}
              onChangeCustom={(indexes) =>
                announceState({ ...gameRef.current, customPattern: indexes })
              }
            />
          </View>
        )}

        {/* ── Ball display ──────────────────────────────────────────────── */}
        <View style={styles.ballContainer}>
          <View style={[styles.ballOuter, { backgroundColor: currentColor }]}>
            <View style={styles.ballInner}>
              {game.currentBall ? (
                <>
                  <Text style={styles.ballLetter}>{currentLetter}</Text>
                  <Text style={styles.ballNumber}>{game.currentBall}</Text>
                </>
              ) : (
                <Text style={styles.ballEmpty}>No ball</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Host: Draw / Reset button ─────────────────────────────────── */}
        {isHost && (
          <View style={styles.section}>
            {gameComplete ? (
              <TouchableOpacity
                style={[styles.primaryButton, styles.destructiveButton]}
                onPress={() => setShowResetConfirm(true)}
              >
                <Text style={styles.primaryButtonText}>Reset Game</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, game.isDrawing && styles.primaryButtonDisabled]}
                onPress={drawNewBall}
                disabled={game.isDrawing}
              >
                {game.isDrawing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Draw Ball</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Host: Winners panel ───────────────────────────────────────── */}
        {isHost && (game.winners ?? []).length > 0 && (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.winnersHeader}>
                <Text style={styles.cardSectionTitle}>Winners</Text>
                {(game.winners ?? []).filter((w) => w.status === "pending").length > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>
                      {(game.winners ?? []).filter((w) => w.status === "pending").length} pending
                    </Text>
                  </View>
                )}
              </View>

              {(game.winners ?? []).map((winner) => (
                <View
                  key={winner.id}
                  style={[
                    styles.winnerCard,
                    winner.status === "approved"
                      ? styles.winnerApproved
                      : winner.status === "rejected"
                        ? styles.winnerRejected
                        : styles.winnerPending,
                  ]}
                >
                  <View style={styles.winnerCardHeader}>
                    <View>
                      <Text style={styles.winnerUsername}>{winner.username}</Text>
                      <Text style={styles.winnerMeta}>
                        Ball {winner.ballNumber} · {PATTERN_LABELS[winner.pattern ?? "none"]}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        winner.status === "approved"
                          ? styles.statusApproved
                          : winner.status === "rejected"
                            ? styles.statusRejected
                            : styles.statusPending,
                      ]}
                    >
                      <Text style={styles.statusText}>{winner.status}</Text>
                    </View>
                  </View>

                  {/* Mini card grid */}
                  <View style={styles.miniGrid}>
                    {winner.cardNumbers.map((num, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.miniCell,
                          winner.punchedIndexes.includes(idx) ? styles.miniCellPunched : null,
                        ]}
                      >
                        <Text style={[styles.miniCellText, winner.punchedIndexes.includes(idx) ? styles.miniCellTextPunched : null]}>
                          {num === null ? "F" : num}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {winner.status === "pending" && (
                    <View style={styles.claimActions}>
                      <TouchableOpacity
                        style={[styles.claimBtn, styles.claimBtnApprove]}
                        onPress={() => handleApproveClaim(winner.id)}
                      >
                        <Text style={styles.primaryButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.claimBtn, styles.claimBtnReject]}
                        onPress={() => handleRejectClaim(winner.id)}
                      >
                        <Text style={styles.primaryButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Player: username field ────────────────────────────────────── */}
        {!isHost && (
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Your Name</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Display name"
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
                onSubmitEditing={saveUsernameToPresence}
              />
              <TouchableOpacity style={styles.saveButton} onPress={saveUsernameToPresence}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Player: bingo card ────────────────────────────────────────── */}
        {!isHost && cardNumbers && (
          <View style={[styles.section, { alignItems: "center" }]}>
            <NumberBingoCard
              numbers={cardNumbers}
              drawnBalls={game.drawnBalls}
              interactive
              punched={punched}
              onCellToggle={handleCellToggle}
              activePattern={game.pattern ?? null}
              customPattern={game.customPattern ?? null}
            />

            <TouchableOpacity
              style={[
                styles.outlineButton,
                { width: "80%", marginTop: 12 },
                game.drawnBalls.length > 0 && styles.outlineButtonDisabled,
              ]}
              onPress={refreshCard}
              disabled={game.drawnBalls.length > 0}
            >
              <Text
                style={[
                  styles.outlineButtonText,
                  game.drawnBalls.length > 0 && { color: "#9ca3af" },
                ]}
              >
                Refresh Card
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { width: "80%", marginTop: 12 },
                !canClaimBingo && styles.primaryButtonDisabled,
              ]}
              onPress={handleClaimBingo}
              disabled={!canClaimBingo}
            >
              <Text style={styles.primaryButtonText}>
                {hasClaimed ? "Bingo Claimed!" : "Claim Bingo"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Called balls ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Called Balls ({game.drawnBalls.length}/75)</Text>
            <View style={styles.calledBalls}>
              {game.drawnBalls.length === 0 ? (
                <Text style={styles.emptyText}>No calls yet</Text>
              ) : (
                [...game.drawnBalls]
                  .sort((a, b) => a - b)
                  .map((ball) => (
                    <View key={ball} style={[styles.ballPill, { backgroundColor: ballColor(ball) }]}>
                      <Text style={styles.ballPillText}>
                        {getBingoLetter(ball)}{ball}
                      </Text>
                    </View>
                  ))
              )}
            </View>

            {/* Players list (host only) */}
            {isHost && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.cardSectionTitle}>Players</Text>
                {players.length === 0 ? (
                  <Text style={styles.emptyText}>No players yet</Text>
                ) : (
                  players.map((p, i) => (
                    <Text key={`${p}-${i}`} style={styles.playerItem}>· {p}</Text>
                  ))
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 16,
  },
  roomTitle: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  roomMeta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  headerActions: { flexDirection: "row" },

  // Complete banner
  completeBanner: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  completeBannerTitle: { fontSize: 22, fontWeight: "bold", color: "#ffffff", marginBottom: 4 },
  completeBannerDesc: { fontSize: 14, color: "#d1d5db", textAlign: "center" },

  // Ball display
  ballContainer: { alignItems: "center", marginVertical: 20 },
  ballOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  ballInner: {
    width: 162,
    height: 162,
    borderRadius: 81,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  ballLetter: { fontSize: 48, fontWeight: "bold", color: "#111827", lineHeight: 52 },
  ballNumber: { fontSize: 56, fontWeight: "bold", color: "#111827", lineHeight: 60 },
  ballEmpty: { fontSize: 16, color: "#9ca3af" },

  // Section
  section: { marginBottom: 16 },

  // Card
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 10 },

  // Buttons
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButtonDisabled: { backgroundColor: "#9ca3af" },
  primaryButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  destructiveButton: { backgroundColor: "#dc2626" },
  outlineButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  outlineButtonDisabled: { borderColor: "#e5e7eb" },
  outlineButtonText: { fontSize: 14, fontWeight: "600", color: "#374151" },

  // Input
  inputLabel: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  row: { flexDirection: "row", alignItems: "center" },
  saveButton: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 14 },

  // Called balls
  calledBalls: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ballPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ballPillText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  // Players
  emptyText: { fontSize: 14, color: "#9ca3af" },
  playerItem: { fontSize: 14, color: "#374151", marginTop: 4 },

  // Winners
  winnersHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  pendingBadge: {
    marginLeft: 8,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pendingBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  winnerCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  winnerApproved: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  winnerRejected: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  winnerPending: { backgroundColor: "#fefce8", borderColor: "#fde68a" },
  winnerCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  winnerUsername: { fontSize: 14, fontWeight: "700", color: "#111827" },
  winnerMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusApproved: { backgroundColor: "#bbf7d0" },
  statusRejected: { backgroundColor: "#fecaca" },
  statusPending: { backgroundColor: "#fef08a" },
  statusText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  miniGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  miniCell: {
    width: "18%",
    margin: "1%",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  miniCellPunched: { backgroundColor: "#111827", borderColor: "#111827" },
  miniCellText: { fontSize: 9, color: "#374151" },
  miniCellTextPunched: { color: "#ffffff" },
  claimActions: { flexDirection: "row", gap: 8 },
  claimBtn: { flex: 1, borderRadius: 6, paddingVertical: 8, alignItems: "center" },
  claimBtnApprove: { backgroundColor: "#111827" },
  claimBtnReject: { backgroundColor: "#dc2626" },

  // Winner name in modal
  winnerName: { fontSize: 20, textAlign: "center", marginVertical: 8, color: "#111827" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "85%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#111827", marginBottom: 8, textAlign: "center" },
  modalDesc: { fontSize: 14, color: "#6b7280", marginBottom: 20, textAlign: "center" },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  modalBtnOutline: { borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#ffffff" },
  modalBtnDestructive: { backgroundColor: "#dc2626" },
  modalBtnTextOutline: { color: "#374151", fontWeight: "600" },
  modalBtnTextWhite: { color: "#ffffff", fontWeight: "700" },
})
