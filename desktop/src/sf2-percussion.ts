import { midiDrumVoice, type DrumVoice } from './drums'

/** Read key labels from SF2's preset → instrument → sample zones, including
 * global key ranges. These are metadata only; audio stays in sf2-player. */
export function sf2PercussionMaps(bytes: Uint8Array): Map<string, DrumVoice[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const text = (at: number, length: number) => new TextDecoder('windows-1252').decode(bytes.subarray(at, at + length)).replace(/\0.*$/s, '').trim()
  const u16 = (at: number) => view.getUint16(at, true)
  const tables = new Map<string, { at: number; size: number }>()
  const scan = (start: number, end: number) => {
    for (let at = start; at + 8 <= end;) {
      const id = text(at, 4), size = view.getUint32(at + 4, true), data = at + 8
      if (data + size > end) throw new Error('SF2 元数据区块超出文件边界')
      if (id === 'LIST' && text(data, 4) === 'pdta') scan(data + 4, data + size)
      else if (['phdr', 'pbag', 'pgen', 'inst', 'ibag', 'igen', 'shdr'].includes(id)) tables.set(id, { at: data, size })
      at = data + size + (size % 2)
    }
  }
  scan(12, Math.min(bytes.length, view.getUint32(4, true) + 8))
  const table = (id: string, width: number) => {
    const entry = tables.get(id)
    if (!entry || entry.size % width) throw new Error(`SF2 缺少有效 ${id} 表`)
    return { ...entry, count: entry.size / width }
  }
  const ph = table('phdr', 38), inst = table('inst', 22), samples = table('shdr', 46)
  type Zone = { low: number; high: number; target?: number }
  const zones = (bagName: string, genName: string, start: number, end: number, targetOp: number): Zone[] => {
    const bag = table(bagName, 4), gen = table(genName, 4), result: Zone[] = []
    if (start > end || end >= bag.count) throw new Error('SF2 区域索引无效')
    for (let index = start; index < end; index++) {
      const from = u16(bag.at + index * 4), to = u16(bag.at + (index + 1) * 4)
      if (from > to || to > gen.count) throw new Error('SF2 生成器索引无效')
      const zone: Zone = { low: 0, high: 127 }
      for (let item = from; item < to; item++) {
        const at = gen.at + item * 4, op = u16(at)
        if (op === 43) { zone.low = view.getUint8(at + 2); zone.high = view.getUint8(at + 3) }
        if (op === targetOp) zone.target = u16(at + 2)
      }
      result.push(zone)
    }
    return result
  }
  const result = new Map<string, DrumVoice[]>()
  for (let index = 0; index < ph.count - 1; index++) {
    const at = ph.at + index * 38, bank = u16(at + 22), program = u16(at + 20)
    const presetZones = zones('pbag', 'pgen', u16(at + 24), u16(at + 38 + 24), 41)
    const presetGlobal = presetZones.find(zone => zone.target === undefined) ?? { low: 0, high: 127 }
    const names = new Map<number, Set<string>>()
    for (const preset of presetZones) {
      if (preset.target === undefined || preset.target >= inst.count - 1) continue
      const instrumentAt = inst.at + preset.target * 22
      const instrumentName = text(instrumentAt, 20)
      const instrumentZones = zones('ibag', 'igen', u16(instrumentAt + 20), u16(instrumentAt + 22 + 20), 53)
      const global = instrumentZones.find(zone => zone.target === undefined) ?? { low: 0, high: 127 }
      for (const zone of instrumentZones) {
        if (zone.target === undefined || zone.target >= samples.count - 1) continue
        const low = Math.max(preset.low, presetGlobal.low, zone.low, global.low)
        const high = Math.min(preset.high, presetGlobal.high, zone.high, global.high, 127)
        const label = text(samples.at + zone.target * 46, 20) || instrumentName
        for (let key = low; key <= high; key++) {
          const labels = names.get(key) ?? new Set<string>(); if (label) labels.add(label); names.set(key, labels)
        }
      }
    }
    result.set(`${bank}:${program}`, [...names].sort(([left], [right]) => left - right).map(([key, labels]) => midiDrumVoice(key, [...labels].join(' / '))))
  }
  return result
}
