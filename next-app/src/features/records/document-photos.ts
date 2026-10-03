export type DocumentPhoto = { data: Uint8Array; width: number; height: number };
export type SavedPhoto = { id: number; session_id: string; original_file_name: string; created_at: string; url: string };

// Re-encoding strips EXIF/location metadata and keeps requests under hosting limits.
export async function preparePhoto(blob: Blob, name = "photo.jpg") {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 처리할 수 없습니다. 다른 브라우저에서 다시 시도해 주세요.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("사진 변환에 실패했습니다.")), "image/jpeg", quality));
    let image = await encode(0.82);
    if (image.size > 600000) image = await encode(0.55);
    if (image.size > 600000) throw new Error("사진 용량이 큽니다. 크기를 줄인 뒤 다시 첨부해 주세요.");
    return { file: new File([image], name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" }), width: canvas.width, height: canvas.height };
  } finally { bitmap.close(); }
}

export async function documentPhotos(files: File[], sessionId?: string | null): Promise<DocumentPhoto[]> {
  let blobs: Blob[] = files;
  if (sessionId) {
    const response = await fetch(`/api/photos?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("저장된 사진을 불러오지 못했습니다. 다시 시도해 주세요.");
    const payload = await response.json();
    blobs = await Promise.all((payload.photos as SavedPhoto[]).map(async photo => {
      const image = await fetch(photo.url, { cache: "no-store" });
      if (!image.ok) throw new Error("사진이 삭제되었거나 불러올 수 없습니다. 새로고침 후 다시 다운로드해 주세요.");
      return image.blob();
    }));
  }
  return Promise.all(blobs.map(async blob => {
    const { file, width, height } = await preparePhoto(blob);
    return { data: new Uint8Array(await file.arrayBuffer()), width, height };
  }));
}
