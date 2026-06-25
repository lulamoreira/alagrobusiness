import { supabase } from "@/integrations/supabase/client";

const BUCKET = "anuncios";

export async function getSignedUrls(paths: string[], expiresIn = 3600): Promise<string[]> {
  if (!paths || paths.length === 0) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, expiresIn);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl ?? "").filter(Boolean);
}

export async function getSignedUrl(path: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl ?? null;
}

export async function uploadAnuncioPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function deleteAnuncioPhotos(paths: string[]): Promise<void> {
  if (!paths || paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
