import Box from "@mui/material/Box";
import { STATUS, warrantyLeft } from "@/lib/format";

// Small pill with a dot. color: a palette key (success, warning, error, neutral, primary)
export function Pill({ color = "neutral", children, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.1,
        py: 0.25,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        color: `${color}.main`,
        bgcolor: `rgba(var(--mui-palette-${color}-mainChannel) / 0.12)`,
        "&::before": { content: '""', width: 6, height: 6, borderRadius: "50%", bgcolor: "currentColor" },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// Remaining warranty as a pill; nothing when no warranty is recorded
export function WarrantyPill({ until, lifetime, sx }) {
  const w = warrantyLeft(until, lifetime);
  return w ? (
    <Pill color={w.color} sx={sx}>
      {w.text}
    </Pill>
  ) : null;
}

export default function StatusBadge({ status, sx }) {
  const s = STATUS[status] ?? STATUS.ok;
  return (
    <Pill color={s.color} sx={sx}>
      {s.label}
    </Pill>
  );
}
