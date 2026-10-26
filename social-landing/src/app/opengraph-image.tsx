import { ImageResponse } from "next/og";

export const alt = "EarnedVoice: Build the reputation your work deserves.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fffaf5", color: "#18181b", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#c2410c" }}>EarnedVoice</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -3, lineHeight: 1.1, maxWidth: 920 }}>Build the reputation your work deserves.</div>
        <div style={{ fontSize: 25, color: "#6b5b50" }}>Brand-guided content for founders, consultants and teams.</div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => <div key={day} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 122, height: 65, borderRadius: 12, fontSize: 18, color: i === 2 ? "#ffffff" : "#9a3412", background: i === 2 ? "#c2410c" : "#fff0e3" }}>{day}</div>)}</div>
    </div>, size,
  );
}