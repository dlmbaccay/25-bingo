import React from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { PATTERN_INDEXES, type PatternId } from "../lib/patterns"

type Props = {
  numbers: (number | null)[]
  drawnBalls: number[]
  interactive?: boolean
  punched: boolean[]
  onCellToggle?: (index: number, newPunched: boolean[]) => void
  activePattern?: PatternId | null
  customPattern?: number[] | null
}

const HEADERS = ["B", "I", "N", "G", "O"]

const NumberBingoCard: React.FC<Props> = ({
  numbers,
  drawnBalls,
  interactive = false,
  punched,
  onCellToggle,
  activePattern = null,
  customPattern = null,
}) => {
  const toggle = (idx: number) => {
    if (!interactive || !onCellToggle) return
    if (idx === 12) return // FREE always stays punched
    const next = [...punched]
    next[idx] = !next[idx]
    onCellToggle(idx, next)
  }

  return (
    <View style={styles.container}>
      {/* Column headers */}
      <View style={styles.row}>
        {HEADERS.map((h) => (
          <View key={h} style={styles.headerCell}>
            <Text style={styles.headerText}>{h}</Text>
          </View>
        ))}
      </View>

      {/* Card grid */}
      <View style={styles.grid}>
        {numbers.map((value, index) => {
          const isFree = value === null
          const called = typeof value === "number" && drawnBalls.includes(value)
          const inPattern =
            activePattern === "custom"
              ? (customPattern ?? []).includes(index)
              : activePattern
                ? PATTERN_INDEXES[activePattern].includes(index)
                : false
          const isPunched = punched[index] || isFree

          return (
            <TouchableOpacity
              key={index}
              onPress={() => toggle(index)}
              activeOpacity={interactive ? 0.7 : 1}
              style={[
                styles.cell,
                isPunched ? styles.cellPunched : styles.cellDefault,
                called && !isPunched ? styles.cellCalled : null,
                inPattern && !isPunched ? styles.cellInPattern : null,
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  isPunched ? styles.cellTextPunched : null,
                  inPattern && !isPunched ? styles.cellTextPattern : null,
                ]}
              >
                {isFree ? "FREE" : value}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {interactive && (
        <Text style={styles.hint}>Tap cells to punch. Green border = called.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  headerCell: {
    width: 52,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  headerText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 280, // 5 cells × 52px + 4 gaps × 4px
  },
  cell: {
    width: 52,
    height: 52,
    margin: 2,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellDefault: {
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
  },
  cellPunched: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  cellCalled: {
    borderColor: "#22c55e",
    borderWidth: 2,
  },
  cellInPattern: {
    borderColor: "#3b82f6",
  },
  cellText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
  },
  cellTextPunched: {
    color: "#ffffff",
  },
  cellTextPattern: {
    color: "#3b82f6",
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
})

export default NumberBingoCard
