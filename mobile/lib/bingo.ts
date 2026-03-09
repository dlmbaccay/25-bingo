import { hashStringToInt, mulberry32, shuffleInPlace } from "./random"

export type BingoCell = number | null

// Generates a 5x5 bingo card (row-major) with center cell free (null)
export function generateCardNumbers(seed: string): BingoCell[] {
  const rng = mulberry32(hashStringToInt(seed))

  const ranges: Array<[number, number]> = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ]

  const cells: BingoCell[] = new Array(25).fill(0)

  for (let c = 0; c < 5; c++) {
    const [start, end] = ranges[c]
    const pool: number[] = []
    for (let n = start; n <= end; n++) pool.push(n)
    shuffleInPlace(pool, rng)
    const chosen = pool.slice(0, 5)
    for (let r = 0; r < 5; r++) {
      cells[r * 5 + c] = chosen[r]
    }
  }

  cells[12] = null
  return cells
}
