import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function EmptyState({ icon, title, description, action }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 1,
        py: 7,
        px: 2,
        border: 1,
        borderColor: "divider",
        borderStyle: "dashed",
        borderRadius: 2.5,
        color: "text.secondary",
      }}
    >
      {icon && <Box sx={{ color: "text.secondary", mb: 0.5, "& svg": { fontSize: 32 } }}>{icon}</Box>}
      <Typography sx={{ fontWeight: 600, color: "text.primary" }}>{title}</Typography>
      {description && <Typography sx={{ maxWidth: 420 }}>{description}</Typography>}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
}
