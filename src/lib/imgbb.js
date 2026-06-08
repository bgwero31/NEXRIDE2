// File: src/lib/imgbb.js

const DEFAULT_IMGBB_API_KEY = "30df4aa05f1af3b3b58ee8a74639e5cf";

export function getImgbbApiKey() {
  return process.env.NEXT_PUBLIC_IMGBB_API_KEY || DEFAULT_IMGBB_API_KEY;
}

export async function uploadToImgBB(file, { name = "nexride-profile" } = {}) {
  const apiKey = getImgbbApiKey();
  if (!apiKey) throw new Error("Missing IMGBB API key");
  if (!file) throw new Error("No image file selected");

  const form = new FormData();
  form.append("image", file);
  form.append("name", `${name}-${Date.now()}`);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    body: form,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {}

  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || "IMGBB upload failed");
  }

  return json?.data?.display_url || json?.data?.url || json?.data?.image?.url || "";
}
