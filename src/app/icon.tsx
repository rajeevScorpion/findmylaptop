import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F97316",
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 17,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "-0.5px",
        }}
      >
        Lf
      </div>
    ),
    { ...size }
  );
}
