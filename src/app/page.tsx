"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import BingoCard from "@/components/BingoCard"
import { RefreshCw } from "lucide-react"

export default function BingoHelper() {
  const [drawnBalls, setDrawnBalls] = useState<number[]>([])
  const [currentBall, setCurrentBall] = useState<number | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Load saved state from localStorage on component mount
  useEffect(() => {
    const savedDrawnBalls = localStorage.getItem('drawnBalls')
    const savedCurrentBall = localStorage.getItem('currentBall')
    
    if (savedDrawnBalls) {
      setDrawnBalls(JSON.parse(savedDrawnBalls))
    }
    if (savedCurrentBall) {
      setCurrentBall(JSON.parse(savedCurrentBall))
    }
  }, [])

  // Save state changes to localStorage
  useEffect(() => {
    localStorage.setItem('drawnBalls', JSON.stringify(drawnBalls))
  }, [drawnBalls])

  useEffect(() => {
    localStorage.setItem('currentBall', JSON.stringify(currentBall))
  }, [currentBall])

  // Generate a new ball that hasn't been drawn yet
  const drawNewBall = () => {
    if (drawnBalls.length === 75) {
      alert("All balls have been drawn!")
      return
    }

    setIsDrawing(true)

    // Simulate the drawing animation
    let counter = 0
    const interval = setInterval(() => {
      // Generate a random ball between 1-75 that hasn't been drawn yet
      let randomBall
      do {
        randomBall = Math.floor(Math.random() * 75) + 1
      } while (drawnBalls.includes(randomBall))

      setCurrentBall(randomBall)
      counter++

      if (counter > 10) {
        clearInterval(interval)
        setIsDrawing(false)
        setDrawnBalls((prev) => [...prev, randomBall])
      }
    }, 100)
  }

  // Get the letter (B, I, N, G, O) based on the ball number
  const getBingoLetter = (number: number) => {
    if (number <= 15) return "B"
    if (number <= 30) return "I"
    if (number <= 45) return "N"
    if (number <= 60) return "G"
    return "O"
  }

  // Get color based on the letter
  const getBallColor = (letter: string) => {
    switch (letter) {
      case "B":
        return "bg-red-500"
      case "I":
        return "bg-blue-500"
      case "N":
        return "bg-green-500"
      case "G":
        return "bg-yellow-500"
      case "O":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  const handleReset = () => {
    setDrawnBalls([])
    setCurrentBall(null)
    localStorage.removeItem('drawnBalls')
    localStorage.removeItem('currentBall')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-row items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-center">LOT 25 BINGO</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="opacity-30 hover:opacity-100 transition-opacity"
            title="Hard Reset"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-semibold">Drawn Balls: {drawnBalls.length}/75</h2>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side - Draw button and current ball */}
        <div className="flex flex-col items-center lg:w-1/3">
          { drawnBalls.length !== 75 && (
            <Button
              size="lg"
              onClick={drawNewBall}
              disabled={isDrawing || drawnBalls.length === 75}
              className="mb-8 text-xl px-10 py-8 w-full max-w-xs font-bold"
            >
              {isDrawing ? "Drawing..." : "Draw Ball"}
            </Button>
          )}

          { drawnBalls.length === 75 && (
            <Button
              size="lg"
              onClick={handleReset}
              className="mb-8 text-xl px-10 py-8 w-full max-w-xs font-bold"
            >
              Reset
            </Button>
          )}

          {currentBall ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="relative"
            >
              <div
                className={`${getBallColor(getBingoLetter(currentBall))} w-[310px] h-[310px] rounded-full flex items-center justify-center shadow-lg`}
              >
                <div className="bg-white w-[260px] h-[260px] rounded-full flex flex-col items-center justify-center">
                  <span className="text-8xl font-bold">{getBingoLetter(currentBall)}</span>
                  <span className="text-9xl font-bold">{currentBall}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="w-[310px] h-[310px] rounded-full border-12 border-gray-300 flex items-center justify-center">
              <span className="text-gray-400 text-xl">No ball drawn</span>
            </div>
          )}
          <BingoCard />
        </div>

        {/* Right side - Drawn balls rack */}
        <div className="lg:w-2/3">
          <Card className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {["B", "I", "N", "G", "O"].map((letter) => (
                <div key={letter} className="flex flex-col">
                  <h3 className="font-bold text-center mb-2 text-2xl">{letter}</h3>
                  <div className="space-y-2">
                    {drawnBalls
                      .filter((ball) => getBingoLetter(ball) === letter)
                      .sort((a, b) => a - b)
                      .map((ball) => (
                        <div
                          key={ball}
                          className={`${getBallColor(getBingoLetter(ball))} w-12 h-12 rounded-full flex items-center justify-center mx-auto`}
                        >
                          <div className="bg-white w-11 h-11 rounded-full flex items-center justify-center">
                            <span className="text-2xl font-bold">{ball}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}