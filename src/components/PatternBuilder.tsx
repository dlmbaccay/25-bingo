"use client"

import type React from "react"
import { PATTERN_INDEXES, PATTERN_LABELS, type PatternId } from "@/lib/patterns"

type Props = {
  patternId: PatternId | null
  customIndexes: number[]
  onChangePatternId: (id: PatternId) => void
  onChangeCustom: (indexes: number[]) => void
}

const headers = ["B", "I", "N", "G", "O"]

export const PatternBuilder: React.FC<Props> = ({ patternId, customIndexes, onChangePatternId, onChangeCustom }) => {
  const activeIndexes: number[] = (() => {
    if (!patternId) return []
    if (patternId === "custom") return customIndexes
    return PATTERN_INDEXES[patternId]
  })()

  const toggleIndex = (idx: number) => {
    // Always treat grid interactions as custom pattern editing
    const set = new Set(customIndexes)
    if (set.has(idx)) set.delete(idx)
    else set.add(idx)
    onChangePatternId("custom")
    onChangeCustom(Array.from(set).sort((a, b) => a - b))
  }

  return (
    <div className="w-full max-w-xs mb-4">
      <div className="grid grid-cols-5 gap-2 mb-2">
        {headers.map((h) => (
          <div key={h} className="flex items-center justify-center font-bold">{h}</div>
        ))}
        {Array.from({ length: 25 }, (_, idx) => idx).map((idx) => {
          const selected = activeIndexes.includes(idx)
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggleIndex(idx)}
              className={`w-12 h-12 rounded-md border-2 ${selected ? "bg-primary border-primary" : "border-gray-300"}`}
              aria-pressed={selected}
            />
          )
        })}
      </div>

      <select
        className="w-full rounded-md border border-gray-300 px-3 py-2"
        value={patternId ?? "horizontal"}
        onChange={(e) => {
          const next = e.target.value as PatternId
          onChangePatternId(next)
          if (next !== "custom") {
            onChangeCustom(PATTERN_INDEXES[next])
          }
        }}
      >
        {Object.entries(PATTERN_LABELS).map(([id, label]) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>

      <button
        type="button"
        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
        onClick={() => {
          onChangePatternId("custom")
          onChangeCustom([])
        }}
      >
        Clear Pattern
      </button>
    </div>
  )
}

export default PatternBuilder


