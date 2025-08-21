export type PatternId =
  | "none"
  | "horizontal"
  | "vertical"
  | "diagonal1"
  | "diagonal2"
  | "x"
  | "blackout"
  | "aroundTheWorld"
  | "custom"

export const PATTERN_LABELS: Record<PatternId, string> = {
  none: "No Pattern",
  horizontal: "Horizontal Line",
  vertical: "Vertical Line",
  diagonal1: "Diagonal TL→BR",
  diagonal2: "Diagonal TR→BL",
  x: "X Pattern",
  blackout: "Blackout",
  aroundTheWorld: "Around the World",
  custom: "Custom",
}

export const PATTERN_INDEXES: Record<PatternId, number[]> = {
  none: [],
  horizontal: [0, 1, 2, 3, 4],
  vertical: [0, 5, 10, 15, 20],
  diagonal1: [0, 6, 12, 18, 24],
  diagonal2: [4, 8, 12, 16, 20],
  x: [0, 4, 6, 8, 12, 16, 18, 20, 24],
  blackout: Array.from({ length: 25 }, (_, i) => i),
  aroundTheWorld: [0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 22, 21, 20, 15, 10, 5],
  custom: [],
}


