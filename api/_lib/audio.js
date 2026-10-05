/** PCM 16 bits little-endian → archivo WAV (cabecera RIFF de 44 bytes). */
export function pcmToWav(pcm, rate = 24000, channels = 1, bits = 16) {
  const data = Buffer.isBuffer(pcm) ? pcm : Buffer.from(pcm);
  const h = Buffer.alloc(44);
  const byteRate = rate * channels * bits / 8;
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(channels * bits / 8, 32); h.writeUInt16LE(bits, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
