import { supabase } from "./supabaseClient";

export type PersistedGameRow = {
  id: string;
  drawn_balls: number[] | null;
  current_ball: number | null;
  updated_at?: string;
};

export type GameState = {
  drawnBalls: number[];
  currentBall: number | null;
};

export async function fetchGameState(
  roomId: string,
): Promise<GameState | null> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("id, drawn_balls, current_ball")
      .eq("id", roomId)
      .maybeSingle();

    if (error) {
      // Table may not exist yet; ignore in client
      return null;
    }
    if (!data) return null;
    return {
      drawnBalls: data.drawn_balls ?? [],
      currentBall: data.current_ball ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveGameState(
  roomId: string,
  state: GameState,
): Promise<void> {
  try {
    await supabase.from("games").upsert(
      {
        id: roomId,
        drawn_balls: state.drawnBalls,
        current_ball: state.currentBall,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch {
    // Ignore in client
  }
}

export async function clearGameState(roomId: string): Promise<void> {
  try {
    await supabase.from("games").delete().eq("id", roomId);
  } catch {
    // Ignore in client
  }
}

export async function validateRoomExists(roomId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("games")
      .select("id")
      .eq("id", roomId)
      .maybeSingle();

    if (error) {
      return false;
    }
    return data !== null;
  } catch {
    return false;
  }
}
