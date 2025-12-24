import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { PATTERN_INDEXES, type PatternId } from "@/lib/patterns"

type Props = {
	numbers: (number | null)[]
	drawnBalls: number[]
	interactive?: boolean
	storageKey?: string
	activePattern?: PatternId | null
	customPattern?: number[] | null
	onPunchChange?: () => void
}

const headers = ["B", "I", "N", "G", "O"]

const NumberBingoCard: React.FC<Props> = ({
	numbers,
	drawnBalls,
	interactive = false,
	storageKey,
	activePattern = null,
	customPattern = null,
	onPunchChange,
}) => {
	const empty = useMemo(() => new Array(25).fill(false) as boolean[], [])
	const [punched, setPunched] = useState<boolean[]>(empty)

	// Load/save punched state from localStorage (per player per room)
	useEffect(() => {
		if (!storageKey) return
		const saved = localStorage.getItem(`punched:${storageKey}`)
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as boolean[]
				if (Array.isArray(parsed) && parsed.length === 25) {
					setPunched(parsed)
					return
				}
			} catch {}
		}
		setPunched(empty)
	}, [storageKey, empty])

	useEffect(() => {
		if (!storageKey) return
		const next = [...punched]
		// Always punch free space (center)
		next[12] = true
		localStorage.setItem(`punched:${storageKey}`, JSON.stringify(next))
		// Notify parent of punch change
		onPunchChange?.()
	}, [punched, storageKey]) // eslint-disable-line react-hooks/exhaustive-deps

	const toggle = (idx: number) => {
		if (!interactive) return
		// Cannot toggle invalid indices
		if (idx < 0 || idx >= 25) return
		setPunched((prev) => {
			const next = [...prev]
			// Keep FREE punched
			if (idx === 12) {
				next[idx] = true
			} else {
				next[idx] = !next[idx]
			}
			return next
		})
	}

	return (
		<div className="mt-8">
			<div className="grid grid-cols-5 gap-2 mb-4">
				{headers.map((h) => (
					<div key={h} className="flex items-center justify-center font-bold text-lg">
						{h}
					</div>
				))}
				{numbers.map((value, index) => {
					const isFree = value === null
					const called = typeof value === "number" && drawnBalls.includes(value)
					const inPattern = activePattern === "custom"
						? (customPattern ?? []).includes(index)
						: activePattern
							? PATTERN_INDEXES[activePattern].includes(index)
							: false
					const isPunched = punched[index] || isFree
					const patternTextClass = inPattern && !isPunched ? "text-blue-600" : ""
					return (
						<button
							key={index}
							onClick={() => toggle(index)}
							className={`w-12 h-12 rounded-md border-2 flex items-center justify-center text-sm font-bold select-none ${
								isPunched ? "bg-primary border-primary text-white" : "border-gray-300 bg-white"
							} ${called ? "ring-2 ring-green-500" : ""} ${patternTextClass}`}
						>
							{isFree ? "FREE" : value}
						</button>
					)
				})}
			</div>
			{interactive && (
				<p className="text-xs text-gray-500">Tap cells to punch. Green ring = called number.</p>
			)}
		</div>
	)
}

export default NumberBingoCard


