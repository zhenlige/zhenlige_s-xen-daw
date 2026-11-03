import type { JiNote, JiProject, RatioSpec } from './types'

export type Fraction = [number, number]

export const TONIC_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const
export const NATURAL_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11] as const
export const PITCH_MODES: Record<string, number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 9, 10, 11], locrian: [0, 1, 3, 5, 6, 8, 10],
  'major-pentatonic': [0, 2, 4, 7, 9], 'minor-pentatonic': [0, 3, 5, 7, 10]
}

const TONIC_SPELLINGS = [
  [0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0],
  [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]
] as const

// 十二个位置分别写作：1、♯1、2、♭3、3、4、♯4、5、♭6、6、♭7、7。
const RELATIVE_LETTER_STEPS = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6] as const
const MINOR_PROFILES = new Set(['dorian', 'phrygian', 'aeolian', 'locrian', 'minor-pentatonic'])
const MODE_LETTER_OVERRIDES: Record<string, Partial<Record<number, number>>> = {
  phrygian: { 1: 1 },
  locrian: { 1: 1, 6: 4 }
}

export const LEGACY_PITCH_RATIOS: Fraction[] = [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [45, 32], [3, 2], [8, 5], [5, 3], [9, 5], [15, 8]]

function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b))
  while (b) [a, b] = [b, a % b]
  return a || 1
}

function reduce([numerator, denominator]: Fraction): Fraction {
  const divisor = gcd(numerator, denominator)
  return [numerator / divisor, denominator / divisor]
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return reduce([left[0] * right[0], left[1] * right[1]])
}

function octaveReduce(ratio: Fraction): Fraction {
  let [numerator, denominator] = reduce(ratio)
  while (numerator < denominator) numerator *= 2
  while (numerator >= denominator * 2) denominator *= 2
  return reduce([numerator, denominator])
}

function interval(root: Fraction, ratio: Fraction): Fraction {
  return octaveReduce(multiply(root, ratio))
}

function majorTriad(root: Fraction): [Fraction, Fraction, Fraction] {
  return [root, interval(root, [5, 4]), interval(root, [3, 2])]
}

function minorTriad(root: Fraction): [Fraction, Fraction, Fraction] {
  return [root, interval(root, [6, 5]), interval(root, [3, 2])]
}

function majorProfile(): Fraction[] {
  const tonic: Fraction = [1, 1]
  const subdominantRoot = interval(tonic, [2, 3])
  const dominantRoot = interval(tonic, [3, 2])
  const [, majorThird, dominant] = majorTriad(tonic)
  const [, sixth] = majorTriad(subdominantRoot)
  const [, leadingTone, second] = majorTriad(dominantRoot)
  const raisedTonic = interval(sixth, [5, 4]) // A 大三和弦的三音：C♯ = 25/24（以 C 为例）
  return [
    tonic, raisedTonic, second, minorTriad(tonic)[1], majorThird, subdominantRoot,
    interval(second, [5, 4]), dominant, minorTriad(subdominantRoot)[1], sixth,
    [7, 4], // 主和弦的协和七度：C7 的 B♭ = 7/4
    leadingTone
  ]
}

function minorProfile(): Fraction[] {
  const tonic: Fraction = [1, 1]
  const subdominantRoot = interval(tonic, [2, 3])
  const dominantRoot = interval(tonic, [3, 2])
  const [, minorThird, dominant] = minorTriad(tonic)
  const [, naturalSixth] = minorTriad(subdominantRoot)
  const [, naturalSeventh, second] = minorTriad(dominantRoot)
  const [, melodicSixth] = majorTriad(subdominantRoot)
  const [, melodicSeventh] = majorTriad(dominantRoot)
  return [
    tonic, interval(melodicSixth, [5, 4]), second, minorThird, majorTriad(tonic)[1], subdominantRoot,
    interval(second, [5, 4]), dominant, naturalSixth, melodicSixth, naturalSeventh, melodicSeventh
  ]
}

export function tuningProfile(mode: string): 'major' | 'minor' {
  return MINOR_PROFILES.has(mode) ? 'minor' : 'major'
}

export function generateTwelveToneRatios(mode: string): Fraction[] {
  const ratios = (tuningProfile(mode) === 'minor' ? minorProfile() : majorProfile()).map(([numerator, denominator]) => [numerator, denominator] as Fraction)
  if (mode === 'phrygian' || mode === 'locrian') ratios[1] = [16, 15] // 降二度，而不是升一度
  if (mode === 'locrian') ratios[6] = [64, 45] // 减五度，而不是增四度
  return ratios
}

export function isLegacyPitchRatios(ratios: Fraction[]): boolean {
  return ratios.length === LEGACY_PITCH_RATIOS.length && ratios.every((ratio, index) => ratio[0] === LEGACY_PITCH_RATIOS[index][0] && ratio[1] === LEGACY_PITCH_RATIOS[index][1])
}

export interface PitchClassSpelling { letter: number; accidental: number }

export function pitchClassSpelling(tonicPitchClass: number, semitonesFromTonic: number, mode = 'chromatic'): PitchClassSpelling {
  const tonic = TONIC_SPELLINGS[((tonicPitchClass % 12) + 12) % 12]
  const offset = ((semitonesFromTonic % 12) + 12) % 12
  const letterStep = MODE_LETTER_OVERRIDES[mode]?.[offset] ?? RELATIVE_LETTER_STEPS[offset]
  const letter = (tonic[0] + letterStep) % 7
  const pitchClass = (tonicPitchClass + offset) % 12
  let accidental = pitchClass - NATURAL_PITCH_CLASSES[letter]
  while (accidental > 6) accidental -= 12
  while (accidental < -6) accidental += 12
  return { letter, accidental }
}

export function pitchNameForOffset(tonicPitchClass: number, semitonesFromTonic: number, mode = 'chromatic'): string {
  const spelling = pitchClassSpelling(tonicPitchClass, semitonesFromTonic, mode)
  const accidental = spelling.accidental > 0 ? '♯'.repeat(spelling.accidental) : '♭'.repeat(-spelling.accidental)
  return `${'CDEFGAB'[spelling.letter]}${accidental}`
}

type TuningSource = Pick<JiProject, 'pitchRatios' | 'pitchNames' | 'pitchMode' | 'pitchTonic' | 'tuningSystem' | 'tuningEdo' | 'tuningIntervals'>
type EdoHarmonizationSource = Pick<JiProject, 'pitchTonic' | 'tuningSystem' | 'tuningEdo' | 'harmonizeRatiosToEdo'>
export interface TuningPitch { value: number; name: string; cents: number; source: string; spelling?: string }

export function edoHarmonizationActive(tuning: EdoHarmonizationSource): boolean {
  return tuning.tuningSystem === 'edo' && Boolean(tuning.harmonizeRatiosToEdo)
}

/** 把独立音符投影到以当前调式主音为基准的最近 N-EDO 格点。 */
export function nearestEdoGridFrequency(frequency: number, tuning: EdoHarmonizationSource): number {
  if (!edoHarmonizationActive(tuning)) return frequency
  const edo = Math.max(2, Math.round(Number(tuning.tuningEdo) || 12))
  const tonic = 261.625565 * 2 ** (tuning.pitchTonic / 12)
  const steps = Math.round(Math.log2(frequency / tonic) * edo)
  return tonic * 2 ** (steps / edo)
}

/** 返回一个原始纯律比例在当前 N-EDO 中最接近的有符号步数。 */
export function ratioEdoSteps(ratio: RatioSpec, tuning: EdoHarmonizationSource): number {
  const edo = Math.max(2, Math.round(Number(tuning.tuningEdo) || 12))
  const value = ratio.direction === 'up' ? ratio.numerator / ratio.denominator : ratio.denominator / ratio.numerator
  return Math.round(Math.log2(value) * edo)
}

export interface EdoGridPosition {
  edo: number
  step: number
  absoluteStep: number
  lowerTonicFrequency: number
}

/** 计算音符相对最近下方（或同音）调式主音的 EDO 步数位置。 */
export function edoGridPosition(frequency: number, tuning: EdoHarmonizationSource): EdoGridPosition {
  const edo = Math.max(2, Math.round(Number(tuning.tuningEdo) || 12))
  const tonic = 261.625565 * 2 ** (tuning.pitchTonic / 12)
  const absoluteStep = Math.round(Math.log2(frequency / tonic) * edo)
  const octave = Math.floor(absoluteStep / edo)
  return { edo, step: absoluteStep - octave * edo, absoluteStep, lowerTonicFrequency: tonic * 2 ** octave }
}

export function customPitchName(tonic: number, interval: { name?: string; numerator?: number; denominator?: number; steps?: number }, system: 'ratio' | 'edo', edo = 12): string {
  if (interval.name?.trim()) return interval.name.trim()
  const octaves = system === 'edo' ? (interval.steps ?? 0) / edo : Math.log2((interval.numerator ?? 1) / (interval.denominator ?? 1))
  return pitchNameForOffset(tonic, Math.round(octaves * 12))
}

export function tuningPitches(tuning: TuningSource): TuningPitch[] {
  const system = tuning.tuningSystem ?? 'preset'
  const raw: Array<Omit<TuningPitch, 'cents'>> = []
  if (system === 'preset') {
    const active = new Set(PITCH_MODES[tuning.pitchMode] || PITCH_MODES.chromatic)
    tuning.pitchRatios.forEach(([numerator, denominator], index) => {
      const spelling = pitchNameForOffset(tuning.pitchTonic, index, tuning.pitchMode)
      if (active.has(index)) raw.push({ value: numerator / denominator, source: `${numerator}/${denominator}`, spelling, name: tuning.pitchNames?.[index]?.trim() || spelling })
    })
  } else {
    raw.push({ value: 1, source: system === 'edo' ? '0 步' : '1/1', name: tuning.pitchNames?.[0]?.trim() || customPitchName(tuning.pitchTonic, {}, system, tuning.tuningEdo) })
    if (system === 'ratio') {
      for (const interval of tuning.tuningIntervals ?? []) {
        const numerator = Number(interval.numerator), denominator = Number(interval.denominator)
        raw.push({ value: numerator / denominator, source: `${numerator}/${denominator}`, name: customPitchName(tuning.pitchTonic, interval, system) })
      }
    } else {
      const edo = Math.max(2, Math.round(Number(tuning.tuningEdo) || 12))
      for (const interval of tuning.tuningIntervals ?? []) {
        const steps = Math.round(Number(interval.steps))
        raw.push({ value: 2 ** (steps / edo), source: `${steps}/${edo} EDO`, name: customPitchName(tuning.pitchTonic, interval, system, edo) })
      }
    }
  }
  const unique = new Map<number, Omit<TuningPitch, 'cents'>>()
  for (const pitch of raw) if (Number.isFinite(pitch.value) && pitch.value >= 1 && pitch.value < 2) unique.set(Math.round(Math.log2(pitch.value) * 1e9), pitch)
  return [...unique.values()].sort((left, right) => left.value - right.value).map(pitch => ({
    ...pitch, cents: 1200 * Math.log2(pitch.value)
  }))
}

function gridPitch(frequency: number, tuning: TuningSource, pitches: TuningPitch[]) {
  const position = Math.log2(frequency / (261.625565 * 2 ** (tuning.pitchTonic / 12)))
  for (const pitch of pitches) {
    const octave = Math.round(position - Math.log2(pitch.value))
    if (Math.abs(position - octave - Math.log2(pitch.value)) * 1200 < .1) return { pitch, octave }
  }
  return undefined
}

function spellingOctave(spelling: string, frequency: number): number {
  const match = /^([A-G])([♯♭]*)$/.exec(spelling)
  const midi = 69 + 12 * Math.log2(frequency / 440)
  if (!match) return Math.floor((Math.round(midi)) / 12) - 1
  const letter = 'CDEFGAB'.indexOf(match[1])
  const alteration = [...match[2]].reduce((sum, char) => sum + (char === '♯' ? 1 : -1), 0)
  return Math.round((midi - NATURAL_PITCH_CLASSES[letter] - alteration) / 12) - 1
}

function spelledFrequencyName(spelling: string, frequency: number, dimension = '', octave = spellingOctave(spelling, frequency)): string {
  return `${spelling}${octave}${dimension}`
}

/** Names shared by tuning tables and note inspectors. Grid labels take priority. */
export function tuningFrequencyName(frequency: number, tuning: TuningSource, pitches = tuningPitches(tuning)): string {
  const tonic = 261.625565 * 2 ** (tuning.pitchTonic / 12)
  const position = Math.log2(frequency / tonic)
  if (tuning.tuningSystem === 'edo') {
    const edo = Math.max(2, Math.round(Number(tuning.tuningEdo) || 12))
    const absoluteStep = Math.round(position * edo)
    if (Math.abs(position - absoluteStep / edo) * 1200 < .1) {
      const steps = ((absoluteStep % edo) + edo) % edo
      const interval = steps === 0 ? { steps, name: tuning.pitchNames?.[0] } : tuning.tuningIntervals.find(item => item.steps === steps) ?? { steps }
      const name = customPitchName(tuning.pitchTonic, interval, 'edo', edo)
      return spelledFrequencyName(name, frequency)
    }
  }
  const match = gridPitch(frequency, tuning, pitches)
  if (match) {
    return spelledFrequencyName(match.pitch.name, frequency)
  }
  const semitone = Math.round(position * 12)
  return spelledFrequencyName(pitchNameForOffset(tuning.pitchTonic, semitone, tuning.pitchMode), frequency)
}

const NATURAL_FIFTHS = [0, 2, 4, -1, 1, 3, 5]
const FIFTH_LETTERS = [0, 4, 1, 5, 2, 6, 3]
const PRIME_FIFTHS = new Map([[2, 0], [3, 1], [5, 4], [7, -2], [11, -1], [13, 3]])
const FACTORS = new Map<number, ReadonlyArray<readonly [number, number]>>()

function factors(integer: number): ReadonlyArray<readonly [number, number]> {
  const cached = FACTORS.get(integer); if (cached) return cached
  let remainder = integer
  const result: Array<[number, number]> = []
  for (let prime = 2; prime * prime <= remainder; prime += prime === 2 ? 1 : 2) {
    let exponent = 0
    while (remainder % prime === 0) { remainder /= prime; exponent++ }
    if (exponent) result.push([prime, exponent])
  }
  if (remainder > 1) result.push([remainder, 1])
  if (FACTORS.size < 4096) FACTORS.set(integer, result)
  return result
}

function primeFifths(prime: number): number {
  const cached = PRIME_FIFTHS.get(prime); if (cached !== undefined) return cached
  const position = Math.log2(prime)
  let best = 0, distance = Infinity
  for (let fifths = -7; fifths <= 7; fifths++) {
    const difference = position - fifths * Math.log2(3 / 2)
    const error = Math.abs(difference - Math.round(difference))
    if (error < distance) { best = fifths; distance = error }
  }
  PRIME_FIFTHS.set(prime, best); return best
}

function fifthsForSpelling(spelling: string): number {
  const match = /^([A-G])([♯♭]*)$/.exec(spelling)!
  return NATURAL_FIFTHS['CDEFGAB'.indexOf(match[1])] + [...match[2]].reduce((sum, char) => sum + (char === '♯' ? 7 : -7), 0)
}

/** Resolve an exact ratio chain before assigning a dimension. Cancelling prime
 * factors must not leave the dimension of an intermediate edge on the label. */
export function tuningNoteName(note: JiNote, notes: ReadonlyMap<string, JiNote>, tuning: TuningSource, frequency = note.frequency, pitches = tuningPitches(tuning)): string {
  const ordinary = tuningFrequencyName(frequency, tuning, pitches)
  if (!note.parentId || !note.ratio || gridPitch(note.frequency, tuning, pitches)) return ordinary
  const exponents = new Map<number, number>(), visited = new Set<string>()
  const add = (integer: number, sign: number) => {
    for (const [prime, exponent] of factors(integer)) exponents.set(prime, (exponents.get(prime) || 0) + exponent * sign)
  }
  let root = note, relativeOctaves = 0
  while (root.parentId && root.ratio) {
    if (visited.has(root.id)) return ordinary
    visited.add(root.id)
    const parent = notes.get(root.parentId); if (!parent) return ordinary
    const sign = root.ratio.direction === 'down' ? -1 : 1
    add(root.ratio.numerator, sign); add(root.ratio.denominator, -sign)
    relativeOctaves += sign * Math.log2(root.ratio.numerator / root.ratio.denominator)
    root = parent
  }
  const anchor = gridPitch(root.frequency, tuning, pitches)
  const rational = anchor && /^(\d+)\/(\d+)$/.exec(anchor.pitch.source)
  let fifths: number
  if (rational) {
    add(Number(rational[1]), 1); add(Number(rational[2]), -1)
    fifths = fifthsForSpelling(pitchNameForOffset(tuning.pitchTonic, 0))
  } else {
    const offset = Math.round(12 * Math.log2(root.frequency / (261.625565 * 2 ** (tuning.pitchTonic / 12))))
    fifths = fifthsForSpelling(pitchNameForOffset(tuning.pitchTonic, offset, tuning.pitchMode))
  }
  let dimension = 2
  for (const [prime, exponent] of exponents) if (exponent) { fifths += primeFifths(prime) * exponent; dimension = Math.max(dimension, prime) }
  const letter = FIFTH_LETTERS[((fifths % 7) + 7) % 7]
  const accidental = (fifths - NATURAL_FIFTHS[letter]) / 7
  const spelling = Math.abs(accidental) <= 2
    ? `${'CDEFGAB'[letter]}${accidental > 0 ? '♯'.repeat(accidental) : '♭'.repeat(-accidental)}`
    : pitchNameForOffset(tuning.pitchTonic, Math.round(12 * Math.log2(frequency / (261.625565 * 2 ** (tuning.pitchTonic / 12)))), tuning.pitchMode)
  const superscript = [...String(dimension)].map(digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)]).join('')
  const rootOffset = Math.round(12 * Math.log2(root.frequency / (261.625565 * 2 ** (tuning.pitchTonic / 12))))
  const rootSpelling = anchor?.pitch.spelling ?? pitchNameForOffset(tuning.pitchTonic, rootOffset, tuning.pitchMode)
  const octave = spellingOctave(rootSpelling, root.frequency) + Math.floor(relativeOctaves + 1e-9)
  return spelledFrequencyName(spelling, frequency, superscript, octave)
}

export function nearestTunedFrequency(frequency: number, tuning: TuningSource): number {
  const tonic = 261.625565 * 2 ** (tuning.pitchTonic / 12)
  let best = frequency, bestDistance = Infinity
  for (let octave = -9; octave <= 9; octave++) for (const pitch of tuningPitches(tuning)) {
    const candidate = tonic * pitch.value * 2 ** octave
    if (candidate < 8 || candidate > 24000) continue
    const distance = Math.abs(Math.log2(frequency / candidate))
    if (distance < bestDistance) { best = candidate; bestDistance = distance }
  }
  return best
}

export function tunedFrequencyForMidiPitch(midiPitch: number, tuning: TuningSource): number {
  return nearestTunedFrequency(440 * 2 ** ((midiPitch - 69) / 12), tuning)
}
