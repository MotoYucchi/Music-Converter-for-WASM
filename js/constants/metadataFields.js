export const METADATA_KEYS = [
  'title',
  'artist',
  'album',
  'albumArtist',
  'track',
  'disc',
  'genre',
  'year',
  'composer',
  'lyricist',
  'lyrics',
  'bpm',
  'comment',
  'copyright'
];

export function createEmptyMetadata(overrides = {}) {
  return {
    title: '',
    artist: '',
    album: '',
    albumArtist: '',
    track: '',
    disc: '',
    genre: '',
    year: '',
    composer: '',
    lyricist: '',
    lyrics: '',
    bpm: '',
    comment: '',
    copyright: '',
    artwork: null, // { data: Uint8Array, mime: string, url: string, width?: number, height?: number }
    ...overrides
  };
}

/**
 * Build FFmpeg -metadata key=value pairs from track metadata object.
 */
export function buildFFmpegMetadataArgs(meta, formatId) {
  const args = [];
  const push = (key, val) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      args.push('-metadata', `${key}=${String(val).trim()}`);
    }
  };

  push('title', meta.title);
  push('artist', meta.artist);
  push('album', meta.album);
  push('album_artist', meta.albumArtist);
  push('track', meta.track);
  push('disc', meta.disc);
  push('genre', meta.genre);
  push('date', meta.year);
  push('composer', meta.composer);
  push('lyricist', meta.lyricist);
  push('lyrics', meta.lyrics);
  push('comment', meta.comment);
  push('copyright', meta.copyright);

  // BPM tag differs slightly across containers
  if (meta.bpm !== undefined && meta.bpm !== null && String(meta.bpm).trim() !== '') {
    const bpmVal = String(meta.bpm).trim();
    if (formatId === 'mp3' || formatId === 'wav' || formatId === 'aiff') {
      push('TBPM', bpmVal);
    } else {
      push('bpm', bpmVal);
    }
  }

  return args;
}
