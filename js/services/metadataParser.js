import { createEmptyMetadata } from '../constants/metadataFields.js';
import { getExtension, stripExtension } from '../utils/formatters.js';

/**
 * Probe audio duration via HTMLAudioElement.
 */
export function probeAudioDuration(objectUrl) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
    };
    audio.onloadedmetadata = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(dur);
    };
    audio.onerror = () => {
      cleanup();
      resolve(0);
    };
    audio.src = objectUrl;
  });
}

function decodeText(bytes, encodingByte) {
  try {
    if (encodingByte === 0) {
      return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/, '');
    }
    if (encodingByte === 1 || encodingByte === 2) {
      // UTF-16 with BOM or UTF-16BE
      if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder('utf-16le').decode(bytes.subarray(2)).replace(/\0+$/, '');
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder('utf-16be').decode(bytes.subarray(2)).replace(/\0+$/, '');
      }
      return new TextDecoder(encodingByte === 2 ? 'utf-16be' : 'utf-16le').decode(bytes).replace(/\0+$/, '');
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/, '');
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\0+$/, '');
  }
}

function readSynchsafe(view, offset) {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

function parseID3v2(bytes, meta) {
  if (bytes.length < 10) return;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return; // 'ID3'

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = bytes[3];
  const tagSize = readSynchsafe(view, 6);
  let pos = 10;
  const end = Math.min(10 + tagSize, bytes.length);

  // Skip extended header if present (bit 6 of flags)
  if ((bytes[5] & 0x40) && pos + 4 <= end) {
    const extSize = version === 4 ? readSynchsafe(view, pos) : view.getUint32(pos, false);
    pos += extSize;
  }

  const mapFrame = (id, text) => {
    const clean = text.trim();
    if (!clean) return;
    switch (id) {
      case 'TIT2': case 'TT2': meta.title = clean; break;
      case 'TPE1': case 'TP1': meta.artist = clean; break;
      case 'TALB': case 'TAL': meta.album = clean; break;
      case 'TPE2': case 'TP2': meta.albumArtist = clean; break;
      case 'TRCK': case 'TRK': meta.track = clean; break;
      case 'TPOS': case 'TPA': meta.disc = clean; break;
      case 'TCON': case 'TCO': meta.genre = clean.replace(/^\(\d+\)/, ''); break;
      case 'TYER': case 'TDRC': case 'TYE': meta.year = clean.slice(0, 4); break;
      case 'TCOM': case 'TCM': meta.composer = clean; break;
      case 'TEXT': case 'TOLY': case 'TXT': meta.lyricist = clean; break;
      case 'TBPM': case 'TBP': meta.bpm = clean; break;
      case 'TCOP': case 'TCR': meta.copyright = clean; break;
      default: break;
    }
  };

  while (pos + 10 <= end) {
    if (version === 2) {
      if (pos + 6 > end) break;
      const frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2]);
      if (frameId === '\0\0\0') break;
      const frameSize = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
      pos += 6;
      if (frameSize <= 0 || pos + frameSize > end) break;
      const payload = bytes.subarray(pos, pos + frameSize);
      if (frameId.startsWith('T') && payload.length > 1) {
        mapFrame(frameId, decodeText(payload.subarray(1), payload[0]));
      }
      pos += frameSize;
      continue;
    }

    const frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    if (frameId === '\0\0\0\0' || !/^[A-Z0-9]{4}$/.test(frameId)) break;

    const frameSize = version === 4 ? readSynchsafe(view, pos + 4) : view.getUint32(pos + 4, false);
    pos += 10;
    if (frameSize <= 0 || pos + frameSize > end) break;

    const payload = bytes.subarray(pos, pos + frameSize);
    if (frameId.startsWith('T') && frameId !== 'TXXX' && payload.length > 1) {
      mapFrame(frameId, decodeText(payload.subarray(1), payload[0]));
    } else if (frameId === 'COMM' && payload.length > 4) {
      const enc = payload[0];
      const rest = payload.subarray(4);
      // Skip short description terminated by 0 (or 0,0 for UTF-16)
      let sep = rest.indexOf(0);
      if (enc === 1 || enc === 2) {
        for (let i = 0; i + 1 < rest.length; i += 2) {
          if (rest[i] === 0 && rest[i + 1] === 0) {
            sep = i + 1;
            break;
          }
        }
      }
      const textBytes = sep >= 0 ? rest.subarray(sep + 1) : rest;
      const comment = decodeText(textBytes, enc).trim();
      if (comment && !meta.comment) meta.comment = comment;
    } else if (frameId === 'USLT' && payload.length > 4) {
      const enc = payload[0];
      const rest = payload.subarray(4);
      let sep = rest.indexOf(0);
      if (enc === 1 || enc === 2) {
        for (let i = 0; i + 1 < rest.length; i += 2) {
          if (rest[i] === 0 && rest[i + 1] === 0) {
            sep = i + 1;
            break;
          }
        }
      }
      const lyricsBytes = sep >= 0 ? rest.subarray(sep + 1) : rest;
      const lyrics = decodeText(lyricsBytes, enc).trim();
      if (lyrics) meta.lyrics = lyrics;
    } else if (frameId === 'APIC' && payload.length > 4 && !meta.artwork) {
      const enc = payload[0];
      let p = 1;
      const mimeEnd = payload.indexOf(0, p);
      if (mimeEnd > p) {
        const mime = new TextDecoder('ascii').decode(payload.subarray(p, mimeEnd)) || 'image/jpeg';
        p = mimeEnd + 2; // skip null + picture type
        // skip description
        if (enc === 1 || enc === 2) {
          while (p + 1 < payload.length && !(payload[p] === 0 && payload[p + 1] === 0)) p += 2;
          p += 2;
        } else {
          const descEnd = payload.indexOf(0, p);
          p = descEnd >= 0 ? descEnd + 1 : p;
        }
        if (p < payload.length) {
          const imgData = payload.slice(p);
          const blob = new Blob([imgData], { type: mime });
          meta.artwork = {
            data: imgData,
            mime,
            url: URL.createObjectURL(blob)
          };
        }
      }
    }

    pos += frameSize;
  }
}

function parseFlac(bytes, meta, info) {
  if (bytes.length < 4) return;
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'fLaC') return;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 4;
  let isLast = false;

  while (!isLast && pos + 4 <= bytes.length) {
    const header = bytes[pos];
    isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockSize = (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    pos += 4;
    if (pos + blockSize > bytes.length) break;

    if (blockType === 0 && blockSize >= 18) {
      // STREAMINFO
      const sr = (bytes[pos + 10] << 12) | (bytes[pos + 11] << 4) | (bytes[pos + 12] >>> 4);
      const channels = ((bytes[pos + 12] >>> 1) & 0x07) + 1;
      info.sampleRate = sr;
      info.channels = channels;
    } else if (blockType === 4) {
      // VORBIS_COMMENT
      let p = pos;
      const vendorLen = view.getUint32(p, true);
      p += 4 + vendorLen;
      if (p + 4 <= pos + blockSize) {
        const count = view.getUint32(p, true);
        p += 4;
        for (let i = 0; i < count && p + 4 <= pos + blockSize; i++) {
          const len = view.getUint32(p, true);
          p += 4;
          if (p + len > pos + blockSize) break;
          const entry = new TextDecoder('utf-8').decode(bytes.subarray(p, p + len));
          p += len;
          const eq = entry.indexOf('=');
          if (eq > 0) {
            const key = entry.slice(0, eq).toUpperCase();
            const val = entry.slice(eq + 1).trim();
            switch (key) {
              case 'TITLE': meta.title = val; break;
              case 'ARTIST': meta.artist = val; break;
              case 'ALBUM': meta.album = val; break;
              case 'ALBUMARTIST': case 'ALBUM ARTIST': meta.albumArtist = val; break;
              case 'TRACKNUMBER': meta.track = val; break;
              case 'DISCNUMBER': meta.disc = val; break;
              case 'GENRE': meta.genre = val; break;
              case 'DATE': case 'YEAR': meta.year = val.slice(0, 4); break;
              case 'COMPOSER': meta.composer = val; break;
              case 'LYRICIST': meta.lyricist = val; break;
              case 'LYRICS': case 'UNSYNCEDLYRICS': meta.lyrics = val; break;
              case 'BPM': meta.bpm = val; break;
              case 'COMMENT': case 'DESCRIPTION': meta.comment = val; break;
              case 'COPYRIGHT': meta.copyright = val; break;
              default: break;
            }
          }
        }
      }
    } else if (blockType === 6 && !meta.artwork) {
      // PICTURE
      let p = pos;
      if (p + 32 <= pos + blockSize) {
        p += 4; // picture type
        const mimeLen = view.getUint32(p, true) ? 0 : view.getUint32(p, false);
        const mLen = view.getUint32(p, false);
        p += 4;
        const mime = new TextDecoder('ascii').decode(bytes.subarray(p, p + mLen)) || 'image/jpeg';
        p += mLen;
        const descLen = view.getUint32(p, false);
        p += 4 + descLen + 16; // skip width, height, depth, colors
        if (p + 4 <= pos + blockSize) {
          const dataLen = view.getUint32(p, false);
          p += 4;
          if (p + dataLen <= pos + blockSize) {
            const imgData = bytes.slice(p, p + dataLen);
            meta.artwork = {
              data: imgData,
              mime: mime || (mimeLen ? 'image/jpeg' : 'image/jpeg'),
              url: URL.createObjectURL(new Blob([imgData], { type: mime }))
            };
          }
        }
      }
    }

    pos += blockSize;
  }
}

function parseMp4Atoms(bytes, start, end, meta) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = start;

  while (pos + 8 <= end) {
    let size = view.getUint32(pos, false);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    if (size === 0) size = end - pos;
    if (size < 8 || pos + size > end) break;

    const headerSize = 8;
    const contentStart = pos + headerSize;
    const contentEnd = pos + size;

    if (['moov', 'udta', 'ilst'].includes(type)) {
      parseMp4Atoms(bytes, contentStart, contentEnd, meta);
    } else if (type === 'meta' && contentStart + 4 <= contentEnd) {
      parseMp4Atoms(bytes, contentStart + 4, contentEnd, meta);
    } else {
      // Check for child 'data' atom inside ilst item
      let inner = contentStart;
      while (inner + 8 <= contentEnd) {
        const dSize = view.getUint32(inner, false);
        const dType = String.fromCharCode(bytes[inner + 4], bytes[inner + 5], bytes[inner + 6], bytes[inner + 7]);
        if (dSize < 8 || inner + dSize > contentEnd) break;
        if (dType === 'data' && dSize >= 16) {
          const dataType = view.getUint32(inner + 8, false);
          const payload = bytes.subarray(inner + 16, inner + dSize);
          if (type === 'covr' && !meta.artwork) {
            const mime = dataType === 14 ? 'image/png' : 'image/jpeg';
            const imgData = payload.slice();
            meta.artwork = {
              data: imgData,
              mime,
              url: URL.createObjectURL(new Blob([imgData], { type: mime }))
            };
          } else if ((type === 'trkn' || type === 'disk') && payload.length >= 6) {
            const num = (payload[2] << 8) | payload[3];
            const total = (payload[4] << 8) | payload[5];
            const formatted = total > 0 ? `${num}/${total}` : `${num}`;
            if (num > 0) {
              if (type === 'trkn') meta.track = formatted;
              else meta.disc = formatted;
            }
          } else if (type === 'tmpo' && payload.length >= 2) {
            const bpm = (payload[0] << 8) | payload[1];
            if (bpm > 0) meta.bpm = String(bpm);
          } else if (dataType === 1) {
            const text = new TextDecoder('utf-8').decode(payload).trim();
            if (text) {
              switch (type) {
                case '\xA9nam': meta.title = text; break;
                case '\xA9ART': meta.artist = text; break;
                case '\xA9alb': meta.album = text; break;
                case 'aART': meta.albumArtist = text; break;
                case '\xA9gen': meta.genre = text; break;
                case '\xA9day': meta.year = text.slice(0, 4); break;
                case '\xA9wrt': meta.composer = text; break;
                case '\xA9lyr': meta.lyrics = text; break;
                case '\xA9cmt': meta.comment = text; break;
                case 'cprt': meta.copyright = text; break;
                default: break;
              }
            }
          }
        }
        inner += dSize;
      }
    }

    pos += size;
  }
}

/**
 * Extract existing metadata, artwork, duration, and basic audio info from a File.
 */
export async function parseAudioFile(file, objectUrl) {
  const meta = createEmptyMetadata({
    title: stripExtension(file.name)
  });
  const info = {
    duration: 0,
    sampleRate: 0,
    channels: 0
  };

  try {
    const ext = getExtension(file.name);
    // Read up to 4MB slice from start for fast metadata/artwork extraction
    const headSlice = file.slice(0, Math.min(file.size, 4 * 1024 * 1024));
    const buffer = await headSlice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (ext === 'mp3' || (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
      parseID3v2(bytes, meta);
    } else if (ext === 'flac') {
      parseFlac(bytes, meta, info);
    } else if (ext === 'm4a' || ext === 'aac' || ext === 'mp4') {
      parseMp4Atoms(bytes, 0, bytes.length, meta);
    } else if (ext === 'wav' && bytes.length >= 28) {
      const view = new DataView(bytes.buffer);
      if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF') {
        info.channels = view.getUint16(22, true);
        info.sampleRate = view.getUint32(24, true);
      }
    }
  } catch {
    // Non-fatal: fallback to filename-based title
  }

  info.duration = await probeAudioDuration(objectUrl);
  return { metadata: meta, info };
}
