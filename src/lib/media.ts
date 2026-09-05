import { supabase } from "@/integrations/supabase/client";

const YEAR = 60 * 60 * 24 * 365;
const MAX_EDGE = 1600;

/** Downscales and re-encodes an image in the browser before upload. */
async function compressImage(file: File): Promise<Blob> {
  if (typeof document === "undefined") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  bitmap.close();
  return blob && blob.size < file.size ? blob : file;
}

export type UploadedMedia = { url: string; kind: "image" | "video" };

export async function uploadMedia(file: File, userId: string): Promise<UploadedMedia> {
  const isImage = file.type.startsWith("image/");
  const body = isImage ? await compressImage(file) : file;
  const ext = isImage && body !== file ? "webp" : (file.name.split(".").pop() ?? "bin");
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("media").upload(path, body, {
    contentType: body instanceof File ? file.type : "image/webp",
    upsert: false,
  });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from("media")
    .createSignedUrl(path, YEAR);
  if (signError || !data) throw signError ?? new Error("Could not prepare the upload");

  return { url: data.signedUrl, kind: isImage ? "image" : "video" };
}
