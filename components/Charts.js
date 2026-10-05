"use client";
// Small charts in plain HTML/CSS: one hue for magnitude, thin bars with a 4px
// rounded data end, the value written at the tip, text in text tokens (never the
// series colour), grey for "unknown", and a tooltip on every mark.
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

// Validated blue (slot 1) for each mode; unknown/other = muted grey
const bar = (theme, muted) => ({
  backgroundColor: muted ? "#b9b8b2" : "#2a78d6",
  ...theme.applyStyles("dark", { backgroundColor: muted ? "#55544f" : "#3987e5" }),
});
const track = (theme) => ({
  backgroundColor: "#e6edf8",
  ...theme.applyStyles("dark", { backgroundColor: "#1c2a44" }),
});

const fmt = (n) => Number(n).toLocaleString("th-TH");

/**
 * Horizontal bars, largest first. items: [{ label, value, text?, sub?, muted?, href? }]
 * text: what to print at the tip (default: the number). sub: tooltip detail.
 */
export function BarList({ items, max, unit = "" }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      {items.map((i) => (
        <Tooltip key={i.label} title={`${i.label}: ${i.text ?? fmt(i.value)}${unit ? ` ${unit}` : ""}${i.sub ? ` · ${i.sub}` : ""}`} placement="top-start" arrow>
          <Box
            component="li"
            sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(84px, 38%) 1fr", sm: "minmax(110px, 34%) 1fr" }, alignItems: "center", gap: 1.5 }}
          >
            <Typography noWrap sx={{ fontSize: 13, color: i.muted ? "text.secondary" : "text.primary" }}>
              {i.label}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <Box
                aria-hidden
                sx={(theme) => ({
                  height: 16,
                  width: `${Math.max(0.8, (i.value / top) * 86)}%`,
                  minWidth: 3,
                  borderRadius: "0 4px 4px 0", // square at the baseline, rounded data end
                  ...bar(theme, i.muted),
                })}
              />
              <Typography sx={{ fontSize: 12.5, fontWeight: 500, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {i.text ?? fmt(i.value)}
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

/** Vertical columns with the value on the cap. items: [{ label, value, sub }] */
export function ColumnChart({ items, height = 150, unit = "" }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", justifyContent: "center" }}>
      {items.map((i) => (
        <Tooltip key={i.label} title={`${i.label}: ${fmt(i.value)}${unit ? ` ${unit}` : ""}${i.sub ? ` · ${i.sub}` : ""}`} arrow>
          <Box component="li" sx={{ flex: "1 1 0", maxWidth: 110, minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* bar area: fixed height, bars grow up from the baseline */}
            <Box
              sx={{
                height: height + 24,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", mb: 0.5 }}>{fmt(i.value)}</Typography>
              <Box
                aria-hidden
                sx={(theme) => ({
                  width: 24,
                  height: Math.max(3, (i.value / top) * height),
                  borderRadius: "4px 4px 0 0", // rounded data end, square on the baseline
                  ...bar(theme, false),
                })}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.75 }}>{i.label}</Typography>
            {i.sub && <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{i.sub}</Typography>}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

/** A percentage against 100%, same-hue track. */
export function Meter({ label, percent, note }) {
  return (
    <Tooltip title={`${label}: ${percent}%${note ? ` · ${note}` : ""}`} placement="top-start" arrow>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(84px, 30%) 1fr auto", sm: "minmax(110px, 28%) 1fr 44px" }, alignItems: "center", gap: 1.5 }}>
        <Typography noWrap sx={{ fontSize: 13 }}>{label}</Typography>
        <Box aria-hidden sx={(theme) => ({ height: 10, borderRadius: 999, overflow: "hidden", ...track(theme) })}>
          <Box sx={(theme) => ({ height: "100%", width: `${percent}%`, borderRadius: 999, ...bar(theme, false) })} />
        </Box>
        <Typography sx={{ fontSize: 12.5, fontWeight: 500, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{percent}%</Typography>
      </Box>
    </Tooltip>
  );
}
