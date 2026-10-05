import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

// Shown while a page's server data loads
export default function Loading() {
  return (
    <Box aria-busy="true" aria-label="กำลังโหลด">
      <Skeleton width={180} height={20} />
      <Skeleton width={320} height={44} sx={{ mb: 3 }} />
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2.5, p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={28} />
        ))}
      </Box>
    </Box>
  );
}
