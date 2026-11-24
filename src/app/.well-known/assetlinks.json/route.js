export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = [...new Set((process.env.NEXRIDE_ANDROID_CERT_FINGERPRINTS || "")
    .split(/[,\s]+/)
    .map((value) => value.toUpperCase())
    .filter((value) => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value)))];

  return Response.json(fingerprints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.nexride.app",
      sha256_cert_fingerprints: fingerprints,
    },
  }] : [], { headers: { "Cache-Control": "no-store" } });
}
