export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 90;
async function extractAudio(file: File) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error("90초 이하 영상을 선택해 주세요.");
    const count = Math.ceil(Math.min(decoded.duration, MAX_VIDEO_SECONDS) * 16000);
    const offline = new OfflineAudioContext(1, count, 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
    const word = (at: number, value: string) => [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
    word(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); word(8, "WAVE"); word(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    word(36, "data"); view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, i) => { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true); });
    return new File([buffer], "observation.wav", { type: "audio/wav" });
  } catch {
    throw new Error("영상의 음성을 추출하지 못했어요. AAC 음성이 포함된 MP4 또는 WebM으로 변환해 다시 선택해 주세요.");
  } finally { await context.close(); }
}
function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "seeked" | "loadeddata", trigger: () => void) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, ready); video.removeEventListener("error", failed); };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("영상을 읽지 못했어요. MP4로 변환해 다시 선택해 주세요.")); };
    const timer = setTimeout(failed, 12000);
    video.addEventListener(event, ready, { once: true }); video.addEventListener("error", failed, { once: true }); trigger();
  });
}
export async function prepareObservationVideo(file: File) {
  if (!file.size || file.size > MAX_VIDEO_BYTES) throw new Error("영상은 100MB 이하로 선택해 주세요.");
  if (!["video/mp4", "video/webm"].includes(file.type)) throw new Error("MP4 또는 WebM 영상을 선택해 주세요.");
  const video = document.createElement("video"), url = URL.createObjectURL(file);
  video.muted = true; video.playsInline = true; video.preload = "auto";
  try {
    await waitFor(video, "loadedmetadata", () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > MAX_VIDEO_SECONDS)
      throw new Error("길이를 확인할 수 있는 90초 이하 영상을 선택해 주세요.");
    if (video.readyState < 2) await waitFor(video, "loadeddata", () => {});
    const canvas = document.createElement("canvas"), scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서는 영상 장면을 읽을 수 없어요.");
    const form = new FormData(), timestamps: number[] = [];
    const media = file.size > 3_000_000 ? await extractAudio(file) : file;
    form.set(media.type === "audio/wav" ? "audio" : "video", media); form.set("duration", String(video.duration));
    let bytes = media.size;
    for (let i = 0; i < 8; i++) {
      const second = Math.max(0, video.duration - 0.1) * i / 7;
      if (Math.abs(video.currentTime - second) > 0.01) await waitFor(video, "seeked", () => { video.currentTime = second; });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.65));
      if (!frame || frame.size > 100000) throw new Error("영상 장면이 너무 커요. 해상도를 줄여 다시 선택해 주세요.");
      bytes += frame.size; form.append("frames", frame, `frame-${i}.jpg`); timestamps.push(Number(second.toFixed(2)));
    }
    if (bytes > 3_900_000) throw new Error("전송할 영상이 너무 커요. 더 짧은 영상을 선택해 주세요.");
    form.set("timestamps", JSON.stringify(timestamps));
    return form;
  } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
}
