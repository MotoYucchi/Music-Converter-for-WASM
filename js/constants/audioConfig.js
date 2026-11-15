export const AUDIO_FORMATS = {
  mp3: {
    id: 'mp3',
    label: 'MP3 (.mp3)',
    ext: 'mp3',
    mime: 'audio/mpeg',
    muxer: 'mp3',
    codec: 'libmp3lame',
    lossy: true,
    defaultBitrate: '320k',
    bitrates: ['128k', '192k', '256k', '320k'],
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000],
    supportedBits: ['16', '24', '32f'],
    supportsArtwork: true,
    supportsId3: true,
    note: 'MP3規格のサンプリング周波数は最大48kHzです（高周波数は自動調整されます）。'
  },
  aac: {
    id: 'aac',
    label: 'AAC (.m4a)',
    ext: 'm4a',
    mime: 'audio/mp4',
    muxer: 'mp4',
    codec: 'aac',
    lossy: true,
    defaultBitrate: '256k',
    bitrates: ['128k', '192k', '256k', '320k'],
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000, 88200, 96000],
    supportedBits: ['16', '24', '32f'],
    supportsArtwork: true,
    supportsId3: false,
    note: 'AACは最大96kHzまで対応しています。'
  },
  wav: {
    id: 'wav',
    label: 'WAV (.wav)',
    ext: 'wav',
    mime: 'audio/wav',
    muxer: 'wav',
    codecByBit: {
      '8': 'pcm_u8',
      '16': 'pcm_s16le',
      '24': 'pcm_s24le',
      '32': 'pcm_s32le',
      '32f': 'pcm_f32le'
    },
    lossy: false,
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000, 384000],
    supportedBits: ['8', '16', '24', '32', '32f'],
    supportsArtwork: false,
    supportsId3: true,
    note: '非圧縮PCM。全bit深度（8bit〜32bit float）および全サンプリング周波数（最大384kHz）に対応。'
  },
  flac: {
    id: 'flac',
    label: 'FLAC (.flac)',
    ext: 'flac',
    mime: 'audio/flac',
    muxer: 'flac',
    codec: 'flac',
    sampleFmtByBit: {
      '8': 's16',
      '16': 's16',
      '24': 's32',
      '32': 's32',
      '32f': 's32'
    },
    lossy: false,
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000, 384000],
    supportedBits: ['8', '16', '24', '32', '32f'],
    supportsArtwork: true,
    supportsId3: false,
    note: '可逆圧縮。FLAC仕様上、整数最大24bit相当（32bit選択時は24bit高精度エンコード）および最大384kHzに対応。'
  },
  alac: {
    id: 'alac',
    label: 'ALAC (.m4a)',
    ext: 'm4a',
    mime: 'audio/mp4',
    muxer: 'mp4',
    codec: 'alac',
    sampleFmtByBit: {
      '8': 's16p',
      '16': 's16p',
      '24': 's32p',
      '32': 's32p',
      '32f': 's32p'
    },
    lossy: false,
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000, 384000],
    supportedBits: ['8', '16', '24', '32', '32f'],
    supportsArtwork: true,
    supportsId3: false,
    note: 'Apple Lossless。16bit / 24bit相当、最大384kHz、ジャケット画像埋め込みに対応。'
  },
  ogg: {
    id: 'ogg',
    label: 'Ogg Vorbis (.ogg)',
    ext: 'ogg',
    mime: 'audio/ogg',
    muxer: 'ogg',
    codec: 'libvorbis',
    lossy: true,
    defaultBitrate: '256k',
    bitrates: ['128k', '192k', '256k', '320k'],
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000],
    supportedBits: ['16', '24', '32f'],
    supportsArtwork: false,
    supportsId3: false,
    note: 'Ogg Vorbisは最大192kHzまで対応しています。'
  },
  opus: {
    id: 'opus',
    label: 'Opus (.opus)',
    ext: 'opus',
    mime: 'audio/opus',
    muxer: 'opus',
    codec: 'libopus',
    lossy: true,
    defaultBitrate: '192k',
    bitrates: ['96k', '128k', '192k', '256k', '320k'],
    supportedRates: [8000, 16000, 48000],
    supportedBits: ['16', '24', '32f'],
    supportsArtwork: false,
    supportsId3: false,
    note: 'Opus規格は内部的に48kHz（または8k/16kHz等）で動作するため、非対応レートは48kHzへ自動リサンプルされます。'
  },
  wma: {
    id: 'wma',
    label: 'WMA (.wma)',
    ext: 'wma',
    mime: 'audio/x-ms-wma',
    muxer: 'asf',
    codec: 'wmav2',
    lossy: true,
    defaultBitrate: '192k',
    bitrates: ['128k', '192k', '256k', '320k'],
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000],
    supportedBits: ['16'],
    supportsArtwork: false,
    supportsId3: false,
    note: 'WMA (WMAv2) は最大48kHz・16bit相当でのエンコードとなります。'
  },
  aiff: {
    id: 'aiff',
    label: 'AIFF (.aiff)',
    ext: 'aiff',
    mime: 'audio/aiff',
    muxer: 'aiff',
    codecByBit: {
      '8': 'pcm_s8',
      '16': 'pcm_s16be',
      '24': 'pcm_s24be',
      '32': 'pcm_s32be',
      '32f': 'pcm_f32be'
    },
    lossy: false,
    supportedRates: [8000, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000, 384000],
    supportedBits: ['8', '16', '24', '32', '32f'],
    supportsArtwork: false,
    supportsId3: true,
    note: '非圧縮PCM (Big-Endian)。全bit深度（8bit〜32bit float）および全サンプリング周波数（最大384kHz）に対応。'
  }
};

export const BIT_DEPTHS = [
  { id: '8', label: '8bit' },
  { id: '16', label: '16bit' },
  { id: '24', label: '24bit' },
  { id: '32', label: '32bit' },
  { id: '32f', label: '32bit float' }
];

export const SAMPLE_RATES = [
  { value: 8000, label: '8kHz' },
  { value: 16000, label: '16kHz' },
  { value: 22050, label: '22.05kHz' },
  { value: 32000, label: '32kHz' },
  { value: 44100, label: '44.1kHz' },
  { value: 48000, label: '48kHz' },
  { value: 88200, label: '88.2kHz' },
  { value: 96000, label: '96kHz' },
  { value: 176400, label: '176.4kHz' },
  { value: 192000, label: '192kHz' },
  { value: 384000, label: '384kHz' }
];

/**
 * Resolve closest valid sample rate for a format.
 */
export function resolveSampleRateForFormat(formatId, requestedRate) {
  const fmt = AUDIO_FORMATS[formatId];
  if (!fmt) return requestedRate;
  if (fmt.supportedRates.includes(requestedRate)) {
    return requestedRate;
  }
  // Pick highest supported rate <= requestedRate, or fallback to highest supported
  const lower = fmt.supportedRates.filter((r) => r <= requestedRate);
  if (lower.length > 0) {
    return lower[lower.length - 1];
  }
  return fmt.supportedRates[fmt.supportedRates.length - 1];
}
