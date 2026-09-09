#!/usr/bin/env bash
set -uo pipefail
set -a && source .env && set +a
pgrep -fl 'ffmpeg|whisper-cli|chrome-headless' && { echo 'ABORT: heavy process alive'; exit 1; }
true
ls media/smoke-ingest/work/timeline.json \
   media/smoke-ingest/raw/aroll/clip01.mp4 \
   media/smoke-ingest/raw/audio/music01.mp3

PORT=4399
BASE="http://127.0.0.1:$PORT"
ART="sdd/specs/spec-e-burgos-005-render-service/cycles/cycle-03/artifacts"
mkdir -p "$ART"

RENDER_API_PORT=$PORT RENDER_API_MEDIA_ROOT="$PWD/media" SWC_NODE_PROJECT=tsconfig.base.json \
  node -r ./apps/render-api/src/server-register.cjs apps/render-api/src/main.ts \
  > "$ART/server.log" 2>&1 &
API_PID=$!

until curl -sf "$BASE/health" > /dev/null; do sleep 0.5; done
curl -s "$BASE/health" | tee "$ART/health.json"            # jobQueue:true, cycle:3, binaries resolved

JOB_ID="$(curl -s -X POST "$BASE/projects/smoke-ingest/jobs" \
  | tee "$ART/job-created.json" \
  | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>process.stdout.write(JSON.parse(s).id))")"
echo "job=$JOB_ID"

SECOND_ID="$(curl -s -X POST "$BASE/projects/smoke-ingest/jobs" \
  | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.error(j.state);process.stdout.write(j.id)})")"
curl -s -o /dev/null -w 'cancel-queued=%{http_code}\n' -X DELETE "$BASE/jobs/$SECOND_ID"   # 200

DEADLINE=$(( $(date +%s) + 1800 ))
while :; do
  SNAP="$(curl -s "$BASE/jobs/$JOB_ID")"
  printf '%s\n' "$SNAP" >> "$ART/job-poll.jsonl"
  STATE="$(printf '%s' "$SNAP" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j.state)})")"
  printf '%s' "$SNAP" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const j=JSON.parse(s);console.log(j.state,JSON.stringify(j.progress))})"
  case "$STATE" in
    succeeded) break ;;
    failed|canceled) echo "SMOKE FAILED: $STATE"; printf '%s\n' "$SNAP" > "$ART/job-final.json"; break ;;
  esac
  [ "$(date +%s)" -ge "$DEADLINE" ] && { echo 'SMOKE FAILED: timeout'; break; }
  sleep 5
done
curl -s "$BASE/jobs/$JOB_ID" > "$ART/job-final.json"

OUT="$(mktemp -t smoke-deliverable).mp4"
curl -s -o "$OUT" -w 'download=%{http_code} %{size_download}\n' \
  "$BASE/projects/smoke-ingest/files/out/$JOB_ID.mp4"

ls -l "media/smoke-ingest/work/renders/$JOB_ID/video-muted.mp4" \
      "media/smoke-ingest/work/renders/$JOB_ID/master.wav" | tee "$ART/intermediates.txt"

ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames \
  -of json "$OUT" | tee "$ART/ffprobe-video-stream.json"
ffprobe -v error -select_streams a:0 \
  -show_entries stream=codec_name,channels,sample_rate,duration \
  -of json "$OUT" | tee "$ART/ffprobe-audio-stream.json"

node -e '
const { execFileSync } = require("node:child_process");
const out = process.argv[1];
const probe = (args) => JSON.parse(execFileSync(process.env.FFPROBE_PATH ?? "ffprobe", args, { encoding: "utf8" }));
let v = probe(["-v","error","-select_streams","v:0","-show_entries","stream=nb_frames,r_frame_rate","-of","json",out]).streams[0];
let frames = Number(v.nb_frames);
if (!Number.isFinite(frames) || frames <= 0) {
  v = probe(["-v","error","-select_streams","v:0","-count_frames","-show_entries","stream=nb_read_frames,r_frame_rate","-of","json",out]).streams[0];
  frames = Number(v.nb_read_frames);
}
const [num, den] = v.r_frame_rate.split("/").map(Number);
const fps = num / den;
const expectedFrames = 538;
const seconds = frames / fps;
const expectedSeconds = expectedFrames / 30;
console.log(JSON.stringify({ frames, expectedFrames, rFrameRate: v.r_frame_rate, fps, seconds, expectedSeconds,
  frameDelta: frames - expectedFrames, secondsDelta: seconds - expectedSeconds,
  withinTolerance: Math.abs(frames - expectedFrames) <= 1 }, null, 2));
' "$OUT" | tee "$ART/duration-check.json"

ffmpeg -nostdin -hide_banner -i "$OUT" -map a:0 \
  -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 \
  | tail -n 20 | tee "$ART/loudnorm-independent.txt"

kill -TERM "$API_PID"; wait "$API_PID"; echo "exit=$?" | tee -a "$ART/server.log"   # exit=0
rm -f "$OUT"
