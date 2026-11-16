# WASM Music Converter

ブラウザ上の WebAssembly (`FFmpeg.wasm`) のみで動作する静的（Static）オーディオコンバーター & メタタグエディタです。音声ファイルの変換やタグ編集はすべてクライアントサイドで完結し、外部サーバーへのアップロードは行いません。

## 主な機能

- **対応フォーマット (9種類)**:
  - MP3 (`.mp3`) / AAC (`.m4a`) / WAV (`.wav`) / FLAC (`.flac`) / ALAC (`.m4a`) / Ogg Vorbis (`.ogg`) / Opus (`.opus`) / WMA (`.wma`) / AIFF (`.aiff`)
- **対応ビット深度 (5種類)**:
  - `8bit` / `16bit` / `24bit` / `32bit` / `32bit float`
- **対応サンプリング周波数 (11種類)**:
  - `8kHz` / `16kHz` / `22.05kHz` / `32kHz` / `44.1kHz` / `48kHz` / `88.2kHz` / `96kHz` / `176.4kHz` / `192kHz` / `384kHz`
- **1ファイル〜複数ファイル同時変換 & ZIP一括ダウンロード**
  - 全体のマスター設定だけでなく、トラックごとの個別出力設定にも対応。
- **個別メタタグ編集（変換前・変換後の両方に対応）**:
  - 曲名、アーティスト名、アルバム名、アルバムアーティスト、トラック番号、ディスク番号、ジャンル、リリース年、作曲者、作詞者、アルバムアートワーク（ジャケット画像）、歌詞、BPM（テンポ）、コメント、著作権情報の全15項目に対応。
  - 変換済みファイルのタグを編集した場合は、音声を再エンコードせず高速にメタタグを再反映します。
- **アルバムメタ一括編集 (Album Meta Edit)**:
  - アルバム共通情報（アルバム名、アルバムアーティスト、ジャケット画像など）の一括適用と、アルバム内楽曲のトラック番号自動連番・個別編集を1画面で行えます。

## ディレクトリ構成

```
├── index.html
├── css/
│   ├── tokens.css                  # デザインシステム・カラー・タイポグラフィ変数
│   ├── base.css                    # ベーススタイル・リセット
│   ├── layout.css                  # アプリシェル・レスポンシブレイアウト
│   ├── components.css              # パネル・ドロップゾーン・トラックカード・プレーヤー
│   └── modals.css                  # 個別メタ編集 / アルバムメタ編集モーダル・トースト
├── js/
│   ├── main.js                     # エントリーポイント・アプリ初期化
│   ├── constants/
│   │   ├── audioConfig.js          # 対応フォーマット・bit・サンプリング周波数定義
│   │   └── metadataFields.js       # 15項目メタデータ定義・FFmpeg引数ビルダー
│   ├── state/
│   │   └── store.js                # リアクティブな状態管理ストア
│   ├── services/
│   │   ├── ffmpegService.js        # FFmpeg.wasm ローダー・変換・変換後再タグ付け
│   │   ├── metadataParser.js       # ID3v2 / FLAC / MP4 / WAV 高速クライアントパーサー
│   │   └── downloadService.js      # 単体ダウンロード・ZIP一括ダウンロード
│   ├── components/
│   │   ├── conversionSettings.js   # マスター出力設定パネル
│   │   ├── dropzone.js             # ドラッグ＆ドロップ・ファイル/フォルダ選択
│   │   ├── trackList.js            # トラックキュー・個別設定・試聴プレーヤー
│   │   ├── metadataEditorModal.js  # 個別15項目メタタグ＆ジャケット画像エディタ
│   │   └── albumMetadataModal.js   # アルバム一括メタエディットモーダル
│   └── utils/
│       ├── formatters.js           # サイズ・時間・周波数フォーマット
│       ├── zipBuilder.js           # 依存ゼロのUTF-8対応ZIPビルダー
│       └── toast.js                # トースト通知
└── vendor/                         # FFmpeg.wasm ローカルバンドル (CDNフォールバック対応)
```

## ローカル実行方法

静的ファイルサーバーで配信するだけで動作します（ビルド手順不要）。

```bash
npm run serve
# または
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080` を開いてください。GitHub Pages などの静的ホスティングにもそのままデプロイできます。

## Cookieless 設計・ご利用上の注意

- **完全 Cookieless 設計**: 本アプリは Cookie、アクセス解析、外部トラッキングを一切使用しません。音声ファイルやメタデータが外部サーバーへ送信されることもありません。
- **端末依存の処理性能**: 初回変換時に約 31MB の WASM コア（`ffmpeg-core.wasm`）をブラウザへ読み込み、すべての音声変換・メタタグ処理をユーザー端末の CPU・メモリ上で実行します。変換速度や大容量ファイル処理の安定性はご利用端末の性能およびブラウザ環境に依存します。

## ライセンス・使用ライブラリ

本プロジェクトのソースコードは [MIT License](LICENSE) のもとで公開されています。また、以下のオープンソースライブラリ・フォントを利用しています（詳細は [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) およびサイト内の [licenses.html](licenses.html) をご参照ください）。

| コンポーネント | バージョン | ライセンス | 用途 |
| --- | --- | --- | --- |
| `@ffmpeg/ffmpeg` | `0.12.15` | MIT | FFmpeg WASM ワーカー制御 |
| `@ffmpeg/util` | `0.12.2` | MIT | 音声ファイル読込ユーティリティ |
| `@ffmpeg/core` (FFmpeg) | `0.12.10` | GPL-2.0-or-later | 音声変換・メタタグ処理 WASM コア |
| Google Fonts (`Inter`, `Noto Sans JP`, `JetBrains Mono`) | - | SIL OFL 1.1 | UI / 等幅フォント |

