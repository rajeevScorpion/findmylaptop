import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  let name = "Find My Laptop";
  let brand = "";
  let price = "";
  let imageData: string | null = null;

  if (slug) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("laptops")
      .select("name, brand, price_label, image_url")
      .eq("slug", slug)
      .single();

    if (data) {
      name = data.name ?? name;
      brand = data.brand ?? "";
      price = data.price_label ?? "";

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
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Laptop image — left column on white */}
        {hasImage && (
          <div
            style={{
              width: 560,
              height: 630,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              borderRight: "1px solid #ececec",
              padding: 50,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageData!}
              style={{ maxWidth: 460, maxHeight: 530, objectFit: "contain" }}
              alt=""
            />
          </div>
        )}

        {/* Content — right column */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "#ffffff",
            padding: hasImage ? "48px 56px" : "64px 96px",
          }}
        >
          {/* Site badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div
              style={{
                width: 30,
                height: 30,
                background: "#F97316",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "white",
              }}
            >
              Lf
            </div>
            <span style={{ fontSize: 13, color: "#9ca3af", letterSpacing: 2 }}>
              FIND MY LAPTOP
            </span>
          </div>

          {brand ? (
            <div style={{ fontSize: 15, color: "#6b7280", marginBottom: 10 }}>
              {brand}
            </div>
          ) : null}

          <div
            style={{
              fontSize: hasImage ? 30 : 40,
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.2,
              marginBottom: 18,
            }}
          >
            {name}
          </div>

          {price ? (
            <div style={{ fontSize: 26, fontWeight: 700, color: "#F97316" }}>{price}</div>
          ) : null}

          <div
            style={{
              marginTop: "auto",
              fontSize: 13,
              color: "#9ca3af",
              paddingTop: 32,
            }}
          >
            Trusted by design students &amp; professionals · laptopfinder.cc
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
