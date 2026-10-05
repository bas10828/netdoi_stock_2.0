import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import { TextLink } from "./Links";

// crumbs: [{ label, href }]; the last one is the current page (no link)
export default function PageHeader({ crumbs, title, subtitle, actions, eyebrow }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2, mb: 3 }}>
      <Box sx={{ minWidth: 0, flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 0.75 }}>
        {crumbs?.length > 0 && (
          <Breadcrumbs aria-label="ตำแหน่งปัจจุบัน" sx={{ color: "text.secondary" }}>
            {crumbs.map((c, i) =>
              i < crumbs.length - 1 ? (
                <TextLink key={i} href={c.href} color="inherit" sx={{ fontWeight: 400 }}>
                  {c.label}
                </TextLink>
              ) : (
                <Typography key={i} component="span" sx={{ fontSize: 13, color: "text.primary", fontWeight: 500 }}>
                  {c.label}
                </Typography>
              )
            )}
          </Breadcrumbs>
        )}
        {eyebrow}
        <Typography variant="h1" sx={{ overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ color: "text.secondary" }}>{subtitle}</Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>{actions}</Box>}
    </Box>
  );
}
