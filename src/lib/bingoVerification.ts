import { PATTERN_INDEXES, type PatternId } from "./patterns";

export type VerificationResult = {
	isValid: boolean;
	reason?: string;
};

export function verifyBingoWin(params: {
	cardNumbers: (number | null)[];
	punchedCells: boolean[];
	drawnBalls: number[];
	pattern: PatternId | null;
	customPattern: number[] | null;
}): VerificationResult {
	// Step 1: Get active pattern indexes
	const patternIndexes =
		params.pattern === "custom"
			? params.customPattern || []
			: params.pattern && params.pattern !== "none"
				? PATTERN_INDEXES[params.pattern]
				: [];

	if (patternIndexes.length === 0) {
		return { isValid: false, reason: "No pattern selected" };
	}

	// Step 2: Verify all pattern cells are punched
	for (const idx of patternIndexes) {
		if (idx === 12) continue; // FREE space always valid
		if (!params.punchedCells[idx]) {
			return { isValid: false, reason: "Pattern not complete" };
		}
	}

	// Step 3: Validate punched cells contain drawn numbers (anti-cheat)
	for (let i = 0; i < 25; i++) {
		if (i === 12) continue; // Skip FREE space
		if (params.punchedCells[i]) {
			const cellNumber = params.cardNumbers[i];
			if (cellNumber === null || !params.drawnBalls.includes(cellNumber)) {
				return { isValid: false, reason: "Invalid punched cell detected" };
			}
		}
	}

	return { isValid: true };
}
