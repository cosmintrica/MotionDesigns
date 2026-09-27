#!/usr/bin/env bash
# Extract review frames at given seconds from rendered segments: frames_from_segments.sh 12.5 40 88 ...
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/review
for t in "$@"; do
  f=$(python3 -c "print(int(round($t*24)))")
  seg=$(( f / 120 * 120 ))
  off=$(python3 -c "print(($f - $seg)/24)")
  file=$(printf "out/segments/seg_%06d.mkv" "$seg")
  [ -f "$file" ] || { echo "missing $file"; continue; }
  ffmpeg -y -loglevel error -ss "$off" -i "$file" -frames:v 1 "out/review/f$(printf '%07.2f' "$t").png"
done
ls out/review | tail -n 5
