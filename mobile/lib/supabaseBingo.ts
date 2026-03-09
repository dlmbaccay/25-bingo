import { supabase } from "./supabaseClient"

export type BingoCallRow = {
  id: string
  room_id: string
  username: string | null
  card_version: number | null
  pattern: string | null
  called_at: string
}

export async function recordBingoCall(params: {
  roomId: string
  username: string
  cardVersion: number
  pattern: string | null
}): Promise<void> {
  const { roomId, username, cardVersion, pattern } = params
  try {
    await supabase.from("bingo_calls").insert({
      room_id: roomId,
      username,
      card_version: cardVersion,
      pattern,
      called_at: new Date().toISOString(),
    })
  } catch {}
}
