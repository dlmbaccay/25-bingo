import { supabase } from "./supabaseClient"
import type { PatternId } from "./patterns"

export type WinnerClaim = {
  id: string
  username: string
  clientId: string
  cardVersion: number
  claimedAt: string
  ballNumber: number
  pattern: PatternId | null
  customPattern?: number[] | null
  status: "pending" | "approved" | "rejected"
  cardNumbers: (number | null)[]
  punchedIndexes: number[]
}

export type GameState = {
  drawnBalls: number[]
  currentBall: number | null
  pattern?: PatternId | null
  customPattern?: number[] | null
  winners: WinnerClaim[]
  isDrawing?: boolean
  resetCount?: number
}

export async function fetchGameState(roomId: string): Promise<GameState | null> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("id, drawn_balls, current_ball, pattern, custom_pattern, winners")
      .eq("id", roomId)
      .maybeSingle()

    if (error || !data) return null

    return {
      drawnBalls: data.drawn_balls ?? [],
      currentBall: data.current_ball ?? null,
      pattern: (data.pattern as PatternId) ?? null,
      customPattern: data.custom_pattern ?? null,
      winners: (data.winners as WinnerClaim[]) ?? [],
    }
  } catch {
    return null
  }
}

export async function saveGameState(roomId: string, state: GameState): Promise<void> {
  try {
    await supabase.from("games").upsert(
      {
        id: roomId,
        drawn_balls: state.drawnBalls,
        current_ball: state.currentBall,
        pattern: state.pattern,
        custom_pattern: state.customPattern,
        winners: state.winners,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
  } catch {}
}

export async function clearGameState(roomId: string): Promise<void> {
  try {
    await supabase.from("games").delete().eq("id", roomId)
  } catch {}
}

export async function validateRoomExists(roomId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("id")
      .eq("id", roomId)
      .maybeSingle()

    if (error) return false
    return data !== null
  } catch {
    return false
  }
}
