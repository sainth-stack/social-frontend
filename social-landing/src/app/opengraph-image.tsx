import { ImageResponse } from "next/og";

export const alt = "OpsBrain AI — Your next week of social content, planned.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f4f2ff", color: "#171827", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#4f46e5" }}>OpsBrain AI</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.1, maxWidth: 920 }}>Your next week of social content, planned.</div>
        <div style={{ fontSize: 25, color: "#475569" }}>AI content ideas. Your brand voice. One clear plan.</div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => <div key={day} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 122, height: 65, borderRadius: 12, fontSize: 18, color: i === 2 ? "white" : "#4f46e5", background: i === 2 ? "#4f46e5" : "white" }}>{day}</div>)}</div>
    </div>, size,
  );
}