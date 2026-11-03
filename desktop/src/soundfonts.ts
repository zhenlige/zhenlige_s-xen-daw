import type { InstrumentState } from './types'

export const BUNDLED_SOUNDFONTS = {
  pc98: { fileName: 'PC-98 Soundfont.sf2' },
  touhou: { fileName: 'Touhou.sf2' }
} as const

export type BundledSoundfontId = keyof typeof BUNDLED_SOUNDFONTS

export function bundledSoundfontId(instrument: Pick<InstrumentState, 'bundledId' | 'name' | 'path'>): BundledSoundfontId | undefined {
  if (instrument.bundledId && Object.hasOwn(BUNDLED_SOUNDFONTS, instrument.bundledId)) return instrument.bundledId
  if (!instrument.path || instrument.path.startsWith('builtin:')) {
    return (Object.keys(BUNDLED_SOUNDFONTS) as BundledSoundfontId[]).find(id => BUNDLED_SOUNDFONTS[id].fileName === instrument.name)
  }
  return undefined
}

export function defaultSf2Instrument(drum = false): InstrumentState {
  return { kind: 'sf2', bundledId: 'pc98', name: BUNDLED_SOUNDFONTS.pc98.fileName, programIndex: drum ? 143 : 0, programName: drum ? 'Standard Drums' : 'Acoustic Piano', bank: drum ? 128 : 0, missing: true }
}
