import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  let name = "Find My Laptop";
  let imageData: string | null = null;

  if (slug) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("laptops")
      .select("name, image_url")
      .eq("slug", slug)
      .single();

    if (data) {
      name = data.name ?? name;

      if (data.image_url) {
        try {
          const res = await fetch(data.image_url, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            const buf = await res.arrayBuffer();
            const contentType = res.headers.get("content-type") ?? "image/jpeg";
            imageData = `data:${contentType};base64,${Buffer.from(buf).toString("base64")}`;
          }
        } catch {}
      }
    }
  }

  const hasImage = imageData !== null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageData!}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: 48,
              fontWeight: 700,
              color: "#111827",
              textAlign: "center",
              padding: 80,
            }}
          >
            {name}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
