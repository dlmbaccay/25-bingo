"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function generateRoomId(): string {
  // 6-char base36 id
  return Math.random().toString(36).slice(2, 8)
}

export default function MultiplayerLobby() {
  const router = useRouter()
  const [joinId, setJoinId] = useState("")

  const createRoom = useCallback(() => {
    const roomId = generateRoomId()
    router.push(`/game/${roomId}?host=1`)
  }, [router])

  const joinRoom = useCallback(() => {
    if (!joinId.trim()) return
    router.push(`/game/${joinId.trim()}`)
  }, [joinId, router])

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-4xl font-bold mb-6">Multiplayer Bingo</h1>
      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Host a Game</h2>
          <p>Create a room and share the link with players.</p>
          <Button className="font-bold" onClick={createRoom}>Create Room</Button>
        </div>

        <div className="h-px bg-gray-200" />

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Join a Game</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-gray-300 px-3 py-2"
              placeholder="Enter Room ID (e.g. abc123)"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") joinRoom()
              }}
            />
            <Button className="font-bold" onClick={joinRoom}>Join</Button>
          </div>
          <p className="text-sm text-gray-500">Example path: /game/abc123</p>
        </div>
      </Card>
    </div>
  )
}


