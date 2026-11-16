# Third-Party Licenses & Attributions

本プロジェクト（WASM Music Converter）では、以下のオープンソースライブラリおよびフォントを利用しています。

## 1. @ffmpeg/ffmpeg
- **Version**: `0.12.15`
- **License**: MIT License
- **Repository**: https://github.com/ffmpegwasm/ffmpeg.wasm
- **Usage**: ブラウザ上で FFmpeg WebAssembly ワーカーを制御する JavaScript ラッパー (`vendor/ffmpeg/`)

## 2. @ffmpeg/util
- **Version**: `0.12.2`
- **License**: MIT License
- **Repository**: https://github.com/ffmpegwasm/ffmpeg.wasm
- **Usage**: 音声データの読み込みユーティリティ (`vendor/ffmpeg-util/`)

## 3. @ffmpeg/core (FFmpeg WebAssembly Core)
- **Version**: `0.12.10`
- **License**: GNU General Public License v2.0 or later (`GPL-2.0-or-later`)
- **Repository**: https://github.com/ffmpegwasm/ffmpeg.wasm-core / https://ffmpeg.org/
- **Usage**: 音声デコード・エンコード・リサンプリング・メタタグ埋め込みを行う WebAssembly バイナリ (`vendor/ffmpeg-core/`)
- **Included Codecs**: `libmp3lame` (LGPL), `libvorbis` (BSD-3-Clause), `libopus` (BSD-3-Clause), `aac`, `flac`, `alac`, `wmav2`, `pcm_*` 等

## 4. Google Fonts (Inter / Noto Sans JP / JetBrains Mono)
- **License**: SIL Open Font License 1.1 (`OFL-1.1`)
- **Source**: https://fonts.google.com/
