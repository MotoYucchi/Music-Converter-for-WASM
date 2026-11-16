import { FFmpeg } from '../../vendor/ffmpeg/index.js';
import { fetchFile } from '../../vendor/ffmpeg-util/index.js';
import { AUDIO_FORMATS, resolveSampleRateForFormat } from '../constants/audioConfig.js';
import { buildFFmpegMetadataArgs } from '../constants/metadataFields.js';
import { getExtension, sanitizeFilename, stripExtension } from '../utils/formatters.js';

class FFmpegService {
  constructor() {
    this.ffmpeg = null;
    this.loadPromise = null;
    this.progressCallback = null;
    this.execQueue = Promise.resolve();
  }

  async ensureLoaded(onStatus) {
    if (this.ffmpeg && this.ffmpeg.loaded) {
      return this.ffmpeg;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      onStatus?.('loading', 'wasm.loading');
      const ffmpeg = new FFmpeg();

      ffmpeg.on('progress', ({ progress }) => {
        if (this.progressCallback && Number.isFinite(progress)) {
          const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
          this.progressCallback(pct);
        }
      });

      const localCoreURL = new URL('../../vendor/ffmpeg-core/ffmpeg-core.js', import.meta.url).href;
      const localWasmURL = new URL('../../vendor/ffmpeg-core/ffmpeg-core.wasm', import.meta.url).href;

      try {
        await ffmpeg.load({
          coreURL: localCoreURL,
          wasmURL: localWasmURL
        });
      } catch (localErr) {
        console.warn('Local FFmpeg core load failed, trying CDN fallback:', localErr);
        const cdnBase = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
        await ffmpeg.load({
          coreURL: `${cdnBase}/ffmpeg-core.js`,
          wasmURL: `${cdnBase}/ffmpeg-core.wasm`
        });
      }

      this.ffmpeg = ffmpeg;
      onStatus?.('ready', 'wasm.ready');
      return ffmpeg;
    })().catch((err) => {
      this.loadPromise = null;
      onStatus?.('error', 'wasm.error');
      throw err;
    });

    return this.loadPromise;
  }

  enqueue(taskFn) {
    const run = this.execQueue.then(taskFn, taskFn);
    this.execQueue = run.catch(() => {});
    return run;
  }

  async prepareArtworkFile(artwork) {
    if (!artwork || !artwork.data) return null;
    let data = artwork.data;
    let mime = artwork.mime || 'image/jpeg';

    // Convert WebP or unknown formats to JPEG for maximum container compatibility
    if (mime !== 'image/jpeg' && mime !== 'image/png') {
      try {
        const blob = new Blob([data], { type: mime });
        const bmp = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        const jpegBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
        if (jpegBlob) {
          data = new Uint8Array(await jpegBlob.arrayBuffer());
          mime = 'image/jpeg';
        }
      } catch {
        // Keep original bytes if canvas conversion fails
      }
    }

    const ext = mime === 'image/png' ? 'png' : 'jpg';
    return { data, ext };
  }

  buildConversionArgs({ inputName, outputName, artworkName, settings, metadata }) {
    const fmt = AUDIO_FORMATS[settings.format];
    if (!fmt) {
      throw new Error(`未対応の出力形式です: ${settings.format}`);
    }

    const args = ['-i', inputName];
    const hasArt = Boolean(artworkName && fmt.supportsArtwork);
    if (hasArt) {
      args.push('-i', artworkName);
      args.push('-map', '0:a:0', '-map', '1:v:0');
      args.push('-c:v', 'copy', '-disposition:v', 'attached_pic');
    } else {
      args.push('-map', '0:a:0', '-vn');
    }

    // Audio codec & bit depth
    if (fmt.codecByBit) {
      const pcmCodec = fmt.codecByBit[settings.bitDepth] || fmt.codecByBit['16'];
      args.push('-c:a', pcmCodec);
    } else {
      args.push('-c:a', fmt.codec);
      if (fmt.sampleFmtByBit) {
        const sampleFmt = fmt.sampleFmtByBit[settings.bitDepth];
        if (sampleFmt) {
          args.push('-sample_fmt', sampleFmt);
        }
      }
    }

    // Bitrate for lossy formats
    if (fmt.lossy) {
      args.push('-b:a', settings.bitrate || fmt.defaultBitrate || '256k');
    }

    // Sample rate (clamped/resolved to format's supported rates)
    const targetRate = resolveSampleRateForFormat(fmt.id, Number(settings.sampleRate));
    if (targetRate) {
      args.push('-ar', String(targetRate));
    }

    // Channels
    if (settings.channels === '1' || settings.channels === '2') {
      args.push('-ac', settings.channels);
    }

    // Container-specific ID3 / muxer flags
    if (fmt.id === 'mp3') {
      args.push('-id3v2_version', '3');
    } else if (fmt.id === 'wav' || fmt.id === 'aiff') {
      args.push('-write_id3v2', '1');
    }

    // Metadata tags
    args.push(...buildFFmpegMetadataArgs(metadata, fmt.id));

    // Output muxer & file
    args.push('-f', fmt.muxer, '-y', outputName);
    return { args, fmt };
  }

  async convertTrack(track, { onStatus, onProgress } = {}) {
    return this.enqueue(async () => {
      const ffmpeg = await this.ensureLoaded(onStatus);
      onStatus?.('busy', 'wasm.busy');
      this.progressCallback = onProgress || null;

      const inputExt = getExtension(track.originalName) || 'bin';
      const inputName = `in_${track.id}.${inputExt}`;
      const fmt = AUDIO_FORMATS[track.settings.format];
      const outputName = `out_${track.id}.${fmt.ext}`;
      let artworkName = null;

      try {
        await ffmpeg.writeFile(inputName, await fetchFile(track.file));

        if (track.metadata?.artwork && fmt.supportsArtwork) {
          const art = await this.prepareArtworkFile(track.metadata.artwork);
          if (art) {
            artworkName = `art_${track.id}.${art.ext}`;
            await ffmpeg.writeFile(artworkName, art.data);
          }
        }

        const { args } = this.buildConversionArgs({
          inputName,
          outputName,
          artworkName,
          settings: track.settings,
          metadata: track.metadata
        });

        const exitCode = await ffmpeg.exec(args);
        if (exitCode !== 0) {
          throw new Error(`FFmpeg 変換エラー (終了コード: ${exitCode})`);
        }

        const outData = await ffmpeg.readFile(outputName);
        const blob = new Blob([outData.buffer], { type: fmt.mime });
        const base = sanitizeFilename(track.metadata?.title || stripExtension(track.originalName));
        const filename = `${base}.${fmt.ext}`;

        onProgress?.(100);
        return { blob, filename, format: fmt.id };
      } finally {
        this.progressCallback = null;
        await this.safeDelete(ffmpeg, inputName);
        await this.safeDelete(ffmpeg, outputName);
        if (artworkName) await this.safeDelete(ffmpeg, artworkName);
        onStatus?.('ready', 'wasm.ready');
      }
    });
  }

  /**
   * Re-apply metadata and artwork onto an already-converted track without re-encoding audio.
   */
  async reapplyMetadataToConverted(track, { onStatus } = {}) {
    if (!track.convertedBlob || !track.convertedFormat) {
      return null;
    }

    return this.enqueue(async () => {
      const ffmpeg = await this.ensureLoaded(onStatus);
      onStatus?.('busy', 'wasm.retagging');

      const fmt = AUDIO_FORMATS[track.convertedFormat];
      if (!fmt) return null;

      const inputName = `retag_in_${track.id}.${fmt.ext}`;
      const outputName = `retag_out_${track.id}.${fmt.ext}`;
      let artworkName = null;

      try {
        const buf = new Uint8Array(await track.convertedBlob.arrayBuffer());
        await ffmpeg.writeFile(inputName, buf);

        const args = ['-i', inputName];
        if (track.metadata?.artwork && fmt.supportsArtwork) {
          const art = await this.prepareArtworkFile(track.metadata.artwork);
          if (art) {
            artworkName = `retag_art_${track.id}.${art.ext}`;
            await ffmpeg.writeFile(artworkName, art.data);
            args.push('-i', artworkName);
            args.push('-map', '0:a:0', '-map', '1:v:0');
            args.push('-c:a', 'copy', '-c:v', 'copy', '-disposition:v', 'attached_pic');
          } else {
            args.push('-map', '0:a:0', '-vn', '-c:a', 'copy');
          }
        } else {
          args.push('-map', '0:a:0', '-vn', '-c:a', 'copy');
        }

        // Clear old metadata and write updated metadata
        args.push('-map_metadata', '-1');
        if (fmt.id === 'mp3') {
          args.push('-id3v2_version', '3');
        } else if (fmt.id === 'wav' || fmt.id === 'aiff') {
          args.push('-write_id3v2', '1');
        }

        args.push(...buildFFmpegMetadataArgs(track.metadata, fmt.id));
        args.push('-f', fmt.muxer, '-y', outputName);

        const exitCode = await ffmpeg.exec(args);
        if (exitCode !== 0) {
          throw new Error(`メタタグ再反映エラー (終了コード: ${exitCode})`);
        }

        const outData = await ffmpeg.readFile(outputName);
        const blob = new Blob([outData.buffer], { type: fmt.mime });
        const base = sanitizeFilename(track.metadata?.title || stripExtension(track.originalName));
        const filename = `${base}.${fmt.ext}`;

        return { blob, filename };
      } finally {
        await this.safeDelete(ffmpeg, inputName);
        await this.safeDelete(ffmpeg, outputName);
        if (artworkName) await this.safeDelete(ffmpeg, artworkName);
        onStatus?.('ready', 'wasm.ready');
      }
    });
  }

  async safeDelete(ffmpeg, path) {
    try {
      await ffmpeg.deleteFile(path);
    } catch {
      // Ignore if file does not exist
    }
  }
}

export const ffmpegService = new FFmpegService();
