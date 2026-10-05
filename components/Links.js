"use client";
// MUI components rendered as Next.js links. Client-side so server pages can use them freely.
import NextLink from "next/link";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";

export function LinkButton(props) {
  return <Button component={NextLink} {...props} />;
}

export function TextLink(props) {
  return <MuiLink component={NextLink} {...props} />;
}
