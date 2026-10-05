"use client";
import { createTheme } from "@mui/material/styles";
import { fontSans } from "@/lib/fonts";

// Calm, neutral UI: grey surfaces, one blue accent, colour only for status.
const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#1D4ED8" },
        success: { main: "#15803D" },
        warning: { main: "#A85A06" },
        error: { main: "#B91C1C" },
        background: { default: "#F7F7F8", paper: "#FFFFFF" },
        text: { primary: "#18181B", secondary: "#5E5E66" },
        divider: "#E4E4E7",
        neutral: { main: "#52525B" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#7DA2FF" },
        success: { main: "#5BD98A" },
        warning: { main: "#F5B544" },
        error: { main: "#FF8080" },
        background: { default: "#0C0C0E", paper: "#151518" },
        text: { primary: "#EDEDEF", secondary: "#A3A3AC" },
        divider: "#2A2A30",
        neutral: { main: "#A8A8B0" },
      },
    },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: fontSans,
    fontSize: 14,
    h1: { fontSize: "1.6rem", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3, "@media (max-width:600px)": { fontSize: "1.35rem" } },
    h2: { fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.4 },
    h3: { fontSize: "0.95rem", fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: "none" } },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, minHeight: 38, paddingInline: 14, whiteSpace: "nowrap" },
        outlined: ({ theme }) => ({
          borderColor: theme.vars.palette.divider,
          color: theme.vars.palette.text.primary,
          backgroundColor: theme.vars.palette.background.paper,
          "&:hover": { backgroundColor: theme.vars.palette.action.hover, borderColor: theme.vars.palette.divider },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          backgroundColor: theme.vars.palette.background.paper,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: theme.vars.palette.divider },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.vars.palette.divider, paddingBlock: 11 }),
        head: ({ theme }) => ({
          fontSize: 12,
          fontWeight: 600,
          color: theme.vars.palette.text.secondary,
          whiteSpace: "nowrap",
          backgroundColor: theme.vars.palette.background.paper,
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          "&:last-child td": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": { backgroundColor: theme.vars.palette.action.hover },
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({ borderRadius: 12, border: `1px solid ${theme.vars.palette.divider}` }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({ border: `1px solid ${theme.vars.palette.divider}`, boxShadow: theme.shadows[4] }),
      },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 12 } },
    },
    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiBreadcrumbs: {
      styleOverrides: { root: { fontSize: 13 } },
    },
  },
});

export default theme;
