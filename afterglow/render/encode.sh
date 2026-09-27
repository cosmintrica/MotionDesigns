#!/usr/bin/env bash
# Mux the rendered video segments with the mastered soundtrack.
#   render/encode.sh            -> out/AFTERGLOW_master.mp4 (high quality, CRF 16)
#                                  AFTERGLOW_1080p.mp4        (2-pass, < 95 MB, for sharing / git)
set -euo pipefail
cd "$(dirname "$0")/.."
SEG=out/segments/list.txt
AUD=out/audio/afterglow_mix.wav
DUR=182
[ -f "$SEG" ] || { echo "missing $SEG (run: node render/render.mjs --video)"; exit 1; }
[ -f "$AUD" ] || { echo "missing $AUD (run: python3 audio/build.py)"; exit 1; }

COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)

# 1) master: visually lossless
ffmpeg -y -hide_banner -loglevel warning -stats \
  -f concat -safe 0 -i "$SEG" -i "$AUD" -map 0:v -map 1:a -t "$DUR" \
  -c:v libx264 -preset slow -crf 16 -tune grain -pix_fmt yuv420p -x264-params aq-mode=3 "${COLOR[@]}" \
  -c:a aac -b:a 320k -movflags +faststart out/AFTERGLOW_master.mp4

# 2) shareable version under GitHub's file limit: 2-pass ABR
TARGET_MB=${TARGET_MB:-92}
ABR=192
VBR=$(( TARGET_MB * 8192 / DUR - ABR ))
echo "web encode: video ${VBR}k + audio ${ABR}k"
ffmpeg -y -hide_banner -loglevel warning -stats -f concat -safe 0 -i "$SEG" -t "$DUR" \
  -c:v libx264 -preset slow -b:v "${VBR}k" -maxrate "$(( VBR * 2 ))k" -bufsize "$(( VBR * 3 ))k" \
  -pix_fmt yuv420p -x264-params aq-mode=3 -pass 1 -passlogfile out/x264pass -an -f null /dev/null
ffmpeg -y -hide_banner -loglevel warning -stats \
  -f concat -safe 0 -i "$SEG" -i "$AUD" -map 0:v -map 1:a -t "$DUR" \
  -c:v libx264 -preset slow -b:v "${VBR}k" -maxrate "$(( VBR * 2 ))k" -bufsize "$(( VBR * 3 ))k" \
  -pix_fmt yuv420p -x264-params aq-mode=3 -pass 2 -passlogfile out/x264pass "${COLOR[@]}" \
  -c:a aac -b:a "${ABR}k" -movflags +faststart AFTERGLOW_1080p.mp4
rm -f out/x264pass*
ls -la out/AFTERGLOW_master.mp4 AFTERGLOW_1080p.mp4
