export type AccidentalDisplayType = "standard" | "single" | "ascii";

function accidentalString(sharps: number, type: AccidentalDisplayType) {
    if (sharps === 0) return "";
    let ans = "";
    switch (type) {
        case "standard":
            return sharps > 0
                ? `${(sharps % 2 ? "♯" : "")}${"𝄪".repeat(Math.floor( sharps / 2))}`
                : `${(sharps % 2 ? "♭" : "")}${"𝄫".repeat(Math.floor(-sharps / 2))}`;
        case "single":
            return sharps > 0 ? "♯".repeat(sharps) : "♭".repeat(-sharps);
        case "ascii":
            return sharps > 0 ? "#".repeat(sharps) : "b".repeat(-sharps);
    }
}

export interface DiatonicInterval {
    steps: number;
    fifths: number;
}

// 计算音程名称（用缩写表示）
export function diatonicIntervalName(interval: DiatonicInterval): string {
    if (interval.steps < 0 || (interval.steps === 0 && interval.fifths < 0)) return `-${diatonicIntervalName({
        steps: -interval.steps,
        fifths: -interval.fifths,
    })}`;
    const quality = Math.abs(interval.fifths) <= 1 ? "P"
        : Math.abs(interval.fifths) <=  5 ? (interval.fifths > 0 ? "M" : "m")
        : Math.abs(interval.fifths) <= 12 ? (interval.fifths > 0 ? "A" : "d")
        : `${Math.floor((Math.abs(interval.fifths) - 6) / 7)}${interval.fifths > 0 ? "A" : "d"}`;
    return `${quality}${interval.steps + 1}`;
}

const NATURALS = [
    {name: "C", fifths: -2},
    {name: "D", fifths:  0},
    {name: "E", fifths:  2},
    {name: "F", fifths: -3},
    {name: "G", fifths: -1},
    {name: "A", fifths:  1},
    {name: "B", fifths:  3},
];

// 根据相对于D4的音程，计算音名
export function diatonicNoteName(note: DiatonicInterval, type: AccidentalDisplayType, accidentalAfterLetter: boolean) {
    const groupNum = Math.floor((note.steps + 1) / 7) + 4;
    const noteNum = note.steps + 1 - (groupNum - 4) * 7;
    return accidentalAfterLetter
        ? `${NATURALS[noteNum].name}${accidentalString((note.fifths - NATURALS[noteNum].fifths) / 7, type)}${groupNum}`
        : `${accidentalString((note.fifths - NATURALS[noteNum].fifths) / 7, type)}${NATURALS[noteNum].name}${groupNum}`;
}