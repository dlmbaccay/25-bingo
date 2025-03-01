import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const patterns = {
  horizontal: [0, 1, 2, 3, 4],
  vertical: [0, 5, 10, 15, 20],
  diagonal1: [0, 6, 12, 18, 24],
  diagonal2: [4, 8, 12, 16, 20],
  x: [0, 4, 6, 8, 12, 16, 18, 20, 24],
  blackout: Array.from({ length: 25 }, (_, i) => i),
  aroundTheWorld: [0, 1, 2, 3, 4, 9, 14, 19, 24, 23, 22, 21, 20, 15, 10, 5],
}

const BingoCard: React.FC = () => {
  const [markedCells, setMarkedCells] = useState<boolean[]>(new Array(25).fill(false))

  const toggleCell = (index: number) => {
    setMarkedCells((prev) => {
      const newMarked = [...prev]
      newMarked[index] = !newMarked[index]
      return newMarked
    })
  }

  const clearPattern = () => {
    setMarkedCells(new Array(25).fill(false))
  }

  const applyPattern = (patternName: string) => {
    const newMarked = new Array(25).fill(false)
    patterns[patternName as keyof typeof patterns].forEach((index) => {
      newMarked[index] = true
    })
    setMarkedCells(newMarked)
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-5 gap-2 mb-4">
        {["B", "I", "N", "G", "O"].map((letter, i) => (
          <div key={letter} className="flex items-center justify-center font-bold text-lg">
            {letter}
          </div>
        ))}
        {markedCells.map((marked, index) => (
          <button
            key={index}
            className={`w-12 h-12 rounded-md border-2 ${marked ? "bg-primary border-primary" : "border-gray-300"}`}
            onClick={() => toggleCell(index)}
          />
        ))}
      </div>
      <div className="flex flex-col space-y-4">
        <Select onValueChange={applyPattern}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a pattern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="horizontal">Horizontal Line</SelectItem>
            <SelectItem value="vertical">Vertical Line</SelectItem>
            <SelectItem value="diagonal1">Diagonal (Top-left to Bottom-right)</SelectItem>
            <SelectItem value="diagonal2">Diagonal (Top-right to Bottom-left)</SelectItem>
            <SelectItem value="x">X Pattern</SelectItem>
            <SelectItem value="blackout">Blackout</SelectItem>
            <SelectItem value="aroundTheWorld">Around the World</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={clearPattern} className="font-bold">Clear Pattern</Button>
      </div>
    </div>
  )
}

export default BingoCard