// Local visual similarity only: no face recognition, model download or network requests.
export type VisualSignature = { colors: number[]; histogram: number[]; edges: number[]; pixels: number[]; captureDay?: string };
export type LocalPhoto = {
  id: string; file: File; selected: boolean; status: "loading" | "ready" | "error";
  url?: string; previewBytes?: number; group?: string; error?: string;
};

export function signatureFromPixels(data: Uint8ClampedArray, width: number, height: number): VisualSignature {
  const colors = Array<number>(48).fill(0), counts = Array<number>(16).fill(0);
  const histogram = Array<number>(24).fill(0), edges: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4;
    const cell = Math.min(3, Math.floor(y * 4 / height)) * 4 + Math.min(3, Math.floor(x * 4 / width));
    counts[cell]++;
    for (let c = 0; c < 3; c++) {
      colors[cell * 3 + c] += data[offset + c] / 255;
      histogram[c * 8 + Math.min(7, Math.floor(data[offset + c] / 32))]++;
    }
    if (x + 1 < width) edges.push(data[offset] + data[offset + 1] + data[offset + 2] > data[offset + 4] + data[offset + 5] + data[offset + 6] ? 1 : 0);
  }
  return { colors: colors.map((n, i) => n / Math.max(1, counts[Math.floor(i / 3)])), histogram: histogram.map(n => n / (width * height)), edges,
    pixels: Array.from(data).filter((_, i) => i % 4 !== 3).map(n => n / 255) };
}

export function visualDistance(a: VisualSignature, b: VisualSignature) {
  const color = a.colors.reduce((sum, n, i) => sum + Math.abs(n - b.colors[i]), 0) / a.colors.length;
  const histogram = a.histogram.reduce((sum, n, i) => sum + Math.abs(n - b.histogram[i]), 0) / 6;
  const edges = a.edges.reduce((sum, n, i) => sum + Math.abs(n - b.edges[i]), 0) / a.edges.length;
  return color * .55 + histogram * .3 + edges * .15;
}

export function sameVisualScene(a: VisualSignature, b: VisualSignature) {
  if (a.captureDay && b.captureDay && a.captureDay !== b.captureDay) return false;
  if (!a.pixels.length || a.pixels.length !== b.pixels.length) return false;
  // Spatial detail prevents a shared classroom palette from dominating the match.
  const detail = Math.sqrt(a.pixels.reduce((sum, n, i) => sum + (n - b.pixels[i]) ** 2, 0) / a.pixels.length);
  const edges = a.edges.reduce((sum, n, i) => sum + Math.abs(n - b.edges[i]), 0) / a.edges.length;
  return detail < .12 && edges < .22 && visualDistance(a, b) < .085;
}

export function closestVisualGroup(signature: VisualSignature, groups: Map<string, VisualSignature | VisualSignature[]>): string | undefined {
  let closest: string | undefined, distance = Infinity;
  for (const [id, value] of groups) {
    const members = Array.isArray(value) ? value : [value];
    // Every pair must match: a chain of loosely related photos cannot grow a group.
    if (!members.length || !members.every(member => sameVisualScene(signature, member))) continue;
    const candidate = Math.max(...members.map(member => visualDistance(signature, member)));
    if (candidate < distance) { distance = candidate; closest = id; }
  }
  return closest;
}

async function decode(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { resizeWidth: 320, resizeQuality: "low" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* Try the browser's image decoder, including native HEIC support where available. */ }
  }
  const url = URL.createObjectURL(file), image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { image.src = ""; reject(new Error("decode timeout")); }, 30000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error("decode failed")); };
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => { image.src = ""; URL.revokeObjectURL(url); } };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

export async function preparePhoto(file: File): Promise<{ blob: Blob; signature: VisualSignature }> {
  const decoded = await decode(file);
  const canvas = document.createElement("canvas"), sample = document.createElement("canvas");
  try {
    const scale = Math.min(1, 256 / Math.max(decoded.width, decoded.height));
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    sample.width = 16; sample.height = 16;
    const pixels = sample.getContext("2d", { willReadFrequently: true });
    if (!context || !pixels) throw new Error("canvas unavailable");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
    pixels.drawImage(canvas, 0, 0, 16, 16);
    const signature = signatureFromPixels(pixels.getImageData(0, 0, 16, 16).data, 16, 16);
    signature.captureDay = file.name.match(/^(20\d{2}[01]\d[0-3]\d)[_ -]/)?.[1];
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("thumbnail failed")), "image/jpeg", .7));
    return { blob, signature };
  } finally { decoded.release(); canvas.width = canvas.height = sample.width = sample.height = 1; }
}
