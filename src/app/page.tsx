"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { validateRoomExists } from "@/lib/supabaseGame";
import { toast } from "sonner";

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export default function LandingPage() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");
  const [name, setName] = useState("");

  // Pre-fill name from localStorage if available
  useEffect(() => {
    const savedName = localStorage.getItem("bingo_username") || "";
    setName(savedName);
  }, []);

  const createRoom = useCallback(() => {
    const roomId = generateRoomId();
    router.push(`/game/${roomId}?host=1`);
  }, [router]);

  const joinRoom = useCallback(async () => {
    if (!joinId.trim() || !name.trim()) return;

    const roomId = joinId.trim();
    const roomExists = await validateRoomExists(roomId);

    if (!roomExists) {
      toast.error("Room not found, ID doesn't exist.");
      return;
    }

    localStorage.setItem("bingo_username", name.trim());
    router.push(`/game/${roomId}`);
  }, [joinId, name, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        joinRoom();
      }
    },
    [joinRoom],
  );

  return (
    <div className="flex flex-col h-screen items-center justify-center px-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-6">25 Bingo</h1>
      </div>

      {/* Two-Card Layout */}
      <div className="flex flex-col gap-8 mb-8">
        {/* Host Card */}
        <Card className="p-8 flex flex-col">
          <div className="flex-1">
            <h2 className="text-xl font-bold">Host a Game</h2>
            <p className="text-sm text-gray-600">
              Create a new bingo room and share the link with players
            </p>
          </div>
          <Button
            onClick={createRoom}
            className="w-full text-base py-6 font-bold"
          >
            Create Room
          </Button>
        </Card>

        {/* Join Card */}
        <Card className="p-8 flex flex-col">
          <div className="flex-1">
            <h2 className="text-xl font-bold">Join a Game</h2>
            <p className="text-sm text-gray-600">
              Enter your name and room ID to join an existing game
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Your Name
                </label>
                <input
                  className="w-full rounded-md border border-gray-300 px-4 py-2.5"
                  placeholder="Enter your display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Room ID
                </label>
                <input
                  className="w-full rounded-md border border-gray-300 px-4 py-2.5"
                  placeholder="e.g. abc123"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          </div>

          <Button
            size="lg"
            onClick={joinRoom}
            disabled={!joinId.trim() || !name.trim()}
            className="w-full text-base py-6 font-bold"
          >
            Join Room
          </Button>
        </Card>
      </div>

      {/* Footer Link to Solo Mode */}
      {/*<div className="text-center text-sm text-gray-500">
        <Link href="/solo" className="hover:text-gray-700 hover:underline">
          Or play solo mode
        </Link>
      </div>*/}
    </div>
  );
}
