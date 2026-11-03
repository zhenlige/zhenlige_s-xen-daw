import { parseRatio } from './ratio'
import type { JiNote, RatioSpec, Track } from './types'

export interface ChordPreset {
  id: string
  limit: 3 | 5 | 7 | 11
  name: string
  english: string
  harmonics: readonly number[]
  source: string
}

const triads = 'https://en.xen.wiki/w/Major_and_minor_triads'
const list = 'https://en.xen.wiki/w/List_of_root-3rd-P5_triads_in_JI'
// Names and exact voicings are intentionally stored together. A prime limit
// describes prime factors, not the number of voices or an added chord degree.
export const CHORD_PRESETS: readonly ChordPreset[] = [
  { id: 'pyth-major', limit: 3, name: '毕达哥拉斯大三和弦', english: 'Pythagorean major triad', harmonics: [64, 81, 96], source: triads },
  { id: 'pyth-minor', limit: 3, name: '毕达哥拉斯小三和弦', english: 'Pythagorean minor triad', harmonics: [54, 64, 81], source: triads },
  { id: 'sus2', limit: 3, name: '挂二和弦', english: 'Suspended second', harmonics: [8, 9, 12], source: list },
  { id: 'sus4', limit: 3, name: '挂四和弦', english: 'Suspended fourth', harmonics: [6, 8, 9], source: list },
  { id: 'just-major', limit: 5, name: '纯律大三和弦', english: 'Just major triad', harmonics: [4, 5, 6], source: triads },
  { id: 'just-minor', limit: 5, name: '纯律小三和弦', english: 'Just minor triad', harmonics: [10, 12, 15], source: triads },
  { id: 'septimal-minor', limit: 7, name: '七限下小三和弦', english: 'Septimal subminor triad', harmonics: [6, 7, 9], source: 'https://en.xen.wiki/w/6:7:9' },
  { id: 'septimal-major', limit: 7, name: '七限上大三和弦', english: 'Septimal supermajor triad', harmonics: [14, 18, 21], source: list },
  { id: 'harmonic-seventh', limit: 7, name: '谐七和弦', english: 'Harmonic seventh chord', harmonics: [4, 5, 6, 7], source: 'https://en.xen.wiki/w/Harmonic_seventh_chord' },
  { id: 'otonal-neutral', limit: 11, name: '十一限泛音中性三和弦', english: '11-limit otonal neutral triad', harmonics: [18, 22, 27], source: list },
  { id: 'utonal-neutral', limit: 11, name: '十一限下泛音中性三和弦', english: '11-limit utonal neutral triad', harmonics: [22, 27, 33], source: list }
]

export function chordRatios(chord: ChordPreset): RatioSpec[] {
  return chord.harmonics.slice(1).map(harmonic => parseRatio(harmonic, chord.harmonics[0], 'up'))
}

/** Return all new voices before mutating the track, so invalid chords are atomic. */
export function createChordNotes(root: JiNote, track: Track, chord: ChordPreset, makeId: () => string): JiNote[] {
  if (track.type === 'drum' || track.type === 'audio' || root.ghost) throw new Error('请选择可发声的旋律音符')
  const result: JiNote[] = []
  for (const ratio of chordRatios(chord)) {
    const frequency = root.frequency * ratio.numerator / ratio.denominator
    if (!Number.isFinite(frequency) || frequency < 8 || frequency > 24000) throw new Error('和弦音超出 8–24000 Hz，未添加')
    if (track.notes.some(note => !note.ghost && note.beat === root.beat && note.duration === root.duration && Math.abs(Math.log2(note.frequency / frequency)) < 1e-9)) continue
    result.push({ id: makeId(), trackId: track.id, beat: root.beat, duration: root.duration, frequency, velocity: root.velocity, muted: root.muted, color: root.color, parentId: root.id, ratio })
  }
  if (track.notes.length + result.length > 10000) throw new Error('每条轨道最多 10000 个音符')
  return result
}
