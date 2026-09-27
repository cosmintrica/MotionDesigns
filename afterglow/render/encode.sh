#!/usr/bin/env bash
# Encode the rendered segments and mux the mastered soundtrack.
#   render/encode.sh video   -> out/web_video.mp4   (2-pass H.264, sized so the final file stays < ~95 MB)
#                               out/hq_video.mp4    (CRF 17, high quality)
#   render/encode.sh mux     -> AFTERGLOW_1080p.mp4 (web video + AAC 192k, for sharing / git)
#                               out/AFTERGLOW_1080p_HQ.mp4 (hq video + AAC 320k)
#   render/encode.sh         -> both steps
set -euo pipefail
cd "$(dirname "$0")/.."
SEG=out/segments/list.txt
AUD=out/audio/afterglow_mix.wav
DUR=182
TARGET_MB=${TARGET_MB:-92}
ABR=192
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
step=${1:-all}

if [ "$step" = video ] || [ "$step" = all ]; then
  [ -f "$SEG" ] || { echo "missing $SEG (run: node render/render.mjs --video)"; exit 1; }
  VBR=$(( TARGET_MB * 8192 / DUR - ABR - 60 ))   # 60k safety margin for container overhead
  echo "web video: ${VBR}k (2-pass)"
  X264=(-c:v libx264 -preset slow -b:v "${VBR}k" -maxrate "$(( VBR * 2 ))k" -bufsize "$(( VBR * 3 ))k" -pix_fmt yuv420p -x264-params aq-mode=3)
  ffmpeg -y -hide_banner -loglevel warning -stats -f concat -safe 0 -i "$SEG" -t "$DUR" "${X264[@]}" -pass 1 -passlogfile out/x264pass -an -f null /dev/null
  ffmpeg -y -hide_banner -loglevel warning -stats -f concat -safe 0 -i "$SEG" -t "$DUR" "${X264[@]}" -pass 2 -passlogfile out/x264pass "${COLOR[@]}" -an out/web_video.mp4
  rm -f out/x264pass*
  echo "hq video: CRF 17"
  ffmpeg -y -hide_banner -loglevel warning -stats -f concat -safe 0 -i "$SEG" -t "$DUR" \
    -c:v libx264 -preset slow -crf 17 -tune grain -pix_fmt yuv420p -x264-params aq-mode=3 "${COLOR[@]}" -an out/hq_video.mp4
fi

if [ "$step" = mux ] || [ "$step" = all ]; then
  [ -f "$AUD" ] || { echo "missing $AUD (run: python3 audio/build.py)"; exit 1; }
  ffmpeg -y -hide_banner -loglevel warning -i out/web_video.mp4 -i "$AUD" -map 0:v -map 1:a -c:v copy \
    -c:a aac -b:a "${ABR}k" -ar 48000 -t "$DUR" -movflags +faststart AFTERGLOW_1080p.mp4
  ffmpeg -y -hide_banner -loglevel warning -i out/hq_video.mp4 -i "$AUD" -map 0:v -map 1:a -c:v copy \
    -c:a aac -b:a 320k -ar 48000 -t "$DUR" -movflags +faststart out/AFTERGLOW_1080p_HQ.mp4
  ls -la AFTERGLOW_1080p.mp4 out/AFTERGLOW_1080p_HQ.mp4
fi
