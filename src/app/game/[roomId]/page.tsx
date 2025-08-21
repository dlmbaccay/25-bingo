"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import NumberBingoCard from "@/components/NumberBingoCard"
import { generateCardNumbers } from "@/lib/bingo"
import { clearGameState, fetchGameState, saveGameState } from "@/lib/supabaseGame"

type GameState = {
  drawnBalls: number[]
  currentBall: number | null
}

function getBingoLetter(number: number): string {
  if (number <= 15) return "B"
  if (number <= 30) return "I"
  if (number <= 45) return "N"
  if (number <= 60) return "G"
  return "O"
}

function getBallColor(letter: string): string {
  switch (letter) {
    case "B":
      return "bg-red-500"
    case "I":
      return "bg-blue-500"
    case "N":
      return "bg-green-500"
    case "G":
      return "bg-yellow-500"
    case "O":
      return "bg-purple-500"
    default:
      return "bg-gray-500"
  }
}

function useClientId(): string {
  const key = "bingo_client_id"
  const [id] = useState(() => {
    if (typeof window === "undefined") return "server"
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const newId = crypto.randomUUID()
    localStorage.setItem(key, newId)
    return newId
  })
  return id
}

export default function GameRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const searchParams = useSearchParams()
  const isHost = searchParams.get("host") === "1"
  const clientId = useClientId()

  const [game, setGame] = useState<GameState>({ drawnBalls: [], currentBall: null })
  const [cardNumbers, setCardNumbers] = useState<(number | null)[] | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const gameRef = useRef<GameState>({ drawnBalls: [], currentBall: null })

  const roomChannelName = useMemo(() => `bingo:room-${roomId}`, [roomId])

  // Keep a ref of the latest game to avoid stale closures in handlers
  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Channel setup
  useEffect(() => {
    const channel = supabase.channel(roomChannelName, {
      config: {
        broadcast: { self: false },
        presence: { key: clientId },
      },
    })

    channel
      .on("broadcast", { event: "state" }, ({ payload }: { payload: GameState }) => {
        const next = payload as GameState
        setGame(next)
      })
      .on("broadcast", { event: "request_state" }, async ({ payload }: { payload: { requester: string } }) => {
        if (!isHost) return
        // Reply with authoritative state
        channel.send({ type: "broadcast", event: "state", payload: gameRef.current })
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>
        const total = Object.values(state).reduce((acc, arr) => acc + arr.length, 0)
        setOnlineCount(total)
        // Host proactively shares state when someone joins
        if (isHost) {
          channel.send({ type: "broadcast", event: "state", payload: gameRef.current })
        }
      })

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString(), role: isHost ? "host" : "player" })
        setIsSubscribed(true)
        // Player requests latest state immediately
        if (!isHost) {
          channel.send({ type: "broadcast", event: "request_state", payload: { requester: clientId } })
        } else {
          // Host announces initial state
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

  // Persist host game state locally per room and load on mount
  useEffect(() => {
    if (!isHost) return
    try {
      // Prefer server state
      fetchGameState(String(roomId)).then((server) => {
        if (server) {
          setGame(server)
          return
        }
      })
      const saved = localStorage.getItem(`game:${roomId}`)
      if (saved) {
        const parsed = JSON.parse(saved) as GameState
        if (parsed && Array.isArray(parsed.drawnBalls)) {
          setGame(parsed)
        }
      }
    } catch {}
  }, [roomId, isHost])

  useEffect(() => {
    if (!isHost) return
    try {
      localStorage.setItem(`game:${roomId}`, JSON.stringify(game))
    } catch {}
  }, [game, roomId, isHost])

  // After subscription, broadcast once using current state
  useEffect(() => {
    if (!isHost || !isSubscribed) return
    channelRef.current?.send({ type: "broadcast", event: "state", payload: gameRef.current })
  }, [isHost, isSubscribed])

  // Generate stable per-player card based on room + client
  useEffect(() => {
    if (!roomId) return
    const seed = `${roomId}:${clientId}`
    setCardNumbers(generateCardNumbers(seed))
  }, [roomId, clientId])

  const announceState = useCallback((next: GameState) => {
    setGame(next)
    gameRef.current = next
    channelRef.current?.send({ type: "broadcast", event: "state", payload: next })
    // Persist to server best-effort
    saveGameState(String(roomId), next)
  }, [roomId])

  const drawNewBall = useCallback(() => {
    if (!isHost || isDrawing) return
    const base = gameRef.current
    if (base.drawnBalls.length === 75) return

    setIsDrawing(true)

    // Use requestAnimationFrame instead of setInterval to avoid flicker
    let steps = 0
    const maxSteps = 10
    let rafId = 0 as unknown as number

    const spin = () => {
      let randomBall: number
      do {
        randomBall = Math.floor(Math.random() * 75) + 1
      } while (gameRef.current.drawnBalls.includes(randomBall))

      const interim: GameState = { drawnBalls: gameRef.current.drawnBalls, currentBall: randomBall }
      setGame(interim)
      steps++
      if (steps > maxSteps) {
        setIsDrawing(false)
        const final: GameState = {
          drawnBalls: [...gameRef.current.drawnBalls, randomBall],
          currentBall: randomBall,
        }
        announceState(final)
        return
      }
      rafId = requestAnimationFrame(spin)
    }
    rafId = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(rafId)
  }, [isHost, isDrawing, announceState])

  const handleReset = useCallback(() => {
    if (!isHost) return
    announceState({ drawnBalls: [], currentBall: null })
    try { localStorage.removeItem(`game:${roomId}`) } catch {}
    clearGameState(String(roomId))
  }, [isHost, announceState])

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/game/${roomId}`
  }, [roomId])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-row items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Room {roomId}</h1>
          <p className="text-sm text-gray-500">{isHost ? "Host" : "Player"} • Online: {onlineCount}</p>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <Button variant="secondary" onClick={handleReset} className="font-bold">Reset</Button>
          )}
          <Button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl)
            }}
            className="font-bold"
          >Copy Join Link</Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 justify-center">
        <div className="flex flex-col items-center lg:w-fit">
          {isHost && game.drawnBalls.length !== 75 && (
            <Button
              size="lg"
              onClick={drawNewBall}
              disabled={isDrawing || game.drawnBalls.length === 75}
              className="mb-6 text-xl px-8 py-6 w-full max-w-xs font-bold"
            >
              {isDrawing ? "Drawing..." : "Draw Ball"}
            </Button>
          )}

          {game.drawnBalls.length === 75 && isHost && (
            <Button
              size="lg"
              onClick={handleReset}
              className="mb-8 text-xl px-10 py-8 w-full max-w-xs font-bold"
            >
              Reset
            </Button>
          )}

          {game.currentBall ? (
            <div className="relative">
              <div className={`${getBallColor(getBingoLetter(game.currentBall))} ${isHost ? "w-[260px] h-[260px]" : "w-[200px] h-[200px]"} rounded-full flex items-center justify-center shadow-lg`}>
                <div className={`bg-white ${isHost ? "w-[210px] h-[210px]" : "w-[160px] h-[160px]"} rounded-full flex flex-col items-center justify-center`}>
                  <span className={`${isHost ? "text-7xl" : "text-5xl"} font-bold`}>{getBingoLetter(game.currentBall)}</span>
                  <span className={`${isHost ? "text-8xl" : "text-6xl"} font-bold`}>{game.currentBall}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${isHost ? "w-[260px] h-[260px]" : "w-[200px] h-[200px]"} rounded-full border-12 border-gray-300 flex items-center justify-center`}>
              <span className="text-gray-400 text-xl">No ball drawn</span>
            </div>
          )}
          {!isHost && cardNumbers && (
            <NumberBingoCard
              numbers={cardNumbers}
              drawnBalls={game.drawnBalls}
              interactive={!isHost}
              storageKey={`${roomId}:${clientId}`}
            />
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
          </Card>
        </div>
      </div>
    </div>
  )
}


