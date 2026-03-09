import React, { useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from "react-native"
import { PATTERN_INDEXES, PATTERN_LABELS, type PatternId } from "../lib/patterns"

type Props = {
  patternId: PatternId | null
  customIndexes: number[]
  onChangePatternId: (id: PatternId) => void
  onChangeCustom: (indexes: number[]) => void
}

const HEADERS = ["B", "I", "N", "G", "O"]
const PATTERN_IDS = Object.keys(PATTERN_LABELS) as PatternId[]

const PatternBuilder: React.FC<Props> = ({
  patternId,
  customIndexes,
  onChangePatternId,
  onChangeCustom,
}) => {
  const [showPicker, setShowPicker] = useState(false)

  const activeIndexes: number[] = (() => {
    if (!patternId) return []
    if (patternId === "custom") return customIndexes
    return PATTERN_INDEXES[patternId]
  })()

  const toggleIndex = (idx: number) => {
    const set = new Set(customIndexes)
    if (set.has(idx)) set.delete(idx)
    else set.add(idx)
    onChangePatternId("custom")
    onChangeCustom(Array.from(set).sort((a, b) => a - b))
  }

  const selectPreset = (id: PatternId) => {
    onChangePatternId(id)
    if (id !== "custom") {
      onChangeCustom(PATTERN_INDEXES[id])
    }
    setShowPicker(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Win Pattern</Text>

      {/* Preset picker button */}
      <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.pickerButtonText}>
          {patternId ? PATTERN_LABELS[patternId] : "Select Pattern"}
        </Text>
        <Text style={styles.pickerChevron}>▼</Text>
      </TouchableOpacity>

      {/* Pattern grid (5×5 toggle) */}
      <View style={styles.row}>
        {HEADERS.map((h) => (
          <View key={h} style={styles.headerCell}>
            <Text style={styles.headerText}>{h}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: 25 }, (_, idx) => idx).map((idx) => {
          const selected = activeIndexes.includes(idx)
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => toggleIndex(idx)}
              style={[styles.cell, selected ? styles.cellSelected : styles.cellDefault]}
              activeOpacity={0.7}
            />
          )
        })}
      </View>

      {/* Clear button */}
      <TouchableOpacity
        style={styles.clearButton}
        onPress={() => {
          onChangePatternId("custom")
          onChangeCustom([])
        }}
      >
        <Text style={styles.clearButtonText}>Clear Pattern</Text>
      </TouchableOpacity>

      {/* Pattern picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Pattern</Text>
            <ScrollView>
              {PATTERN_IDS.map((id) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.modalOption,
                    patternId === id ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => selectPreset(id)}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      patternId === id ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {PATTERN_LABELS[id]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  pickerButtonText: {
    fontSize: 14,
    color: "#111827",
  },
  pickerChevron: {
    fontSize: 10,
    color: "#6b7280",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  headerCell: {
    width: 44,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  headerText: {
    fontWeight: "bold",
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 240,
  },
  cell: {
    width: 44,
    height: 44,
    margin: 2,
    borderRadius: 6,
    borderWidth: 2,
  },
  cellDefault: {
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
  },
  cellSelected: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  clearButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "60%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: "#f3f4f6",
  },
  modalOptionText: {
    fontSize: 15,
    color: "#111827",
  },
  modalOptionTextActive: {
    fontWeight: "700",
  },
})

export default PatternBuilder
