"use client";
import { useEffect, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { siteNameEn } from "@/lib/format";

// One request per page load is enough for the site list
let sitesPromise = null;
function loadSites() {
  sitesPromise ??= fetch("/api/sites")
    .then((r) => r.json())
    .then((d) => d.sites ?? [])
    .catch(() => {
      sitesPromise = null;
      return [];
    });
  return sitesPromise;
}

const norm = (s) => String(s ?? "").trim().toLowerCase();

// Pick an existing site or type a new name.
// value: the typed/selected name. onChange({ site_id, site_name }): site_id when it matches an existing site.
export default function SitePicker({ value, onChange, label = "สถานที่", size, helperText, ...rest }) {
  const [sites, setSites] = useState([]);
  useEffect(() => {
    let alive = true;
    loadSites().then((s) => alive && setSites(s));
    return () => {
      alive = false;
    };
  }, []);

  // Typed text may be the Thai or the English name
  const find = (name) => sites.find((s) => norm(s.name) === norm(name)) ?? sites.find((s) => norm(name) && norm(s.name_en) === norm(name));
  const match = find(value);
  const emit = (name) => {
    const m = find(name);
    onChange({ site_id: m?.id ?? null, site_name: name });
  };

  return (
    <Box>
      <Autocomplete
        freeSolo
        options={sites}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
        filterOptions={(options, { inputValue }) => {
          const q = norm(inputValue);
          return q ? options.filter((o) => norm(o.name).includes(q) || norm(o.name_en).includes(q)) : options;
        }}
        inputValue={value ?? ""}
        onInputChange={(_, v, reason) => {
          if (reason !== "reset" || v) emit(v);
        }}
        onChange={(_, v) => v && typeof v === "object" && onChange({ site_id: v.id, site_name: v.name })}
        renderOption={(props, o) => {
          const { key, ...other } = props;
          return (
            <li key={key} {...other}>
              <Box sx={{ display: "flex", width: "100%", gap: 1 }}>
                <Box component="span" sx={{ minWidth: 0 }}>
                  {o.name}
                  {siteNameEn(o) && (
                    <Typography component="span" sx={{ display: "block", fontSize: 12, color: "text.secondary" }}>
                      {siteNameEn(o)}
                    </Typography>
                  )}
                </Box>
                <Typography component="span" sx={{ ml: "auto", fontSize: 12, color: "text.secondary", flexShrink: 0 }}>
                  {o.job_count} งาน
                </Typography>
              </Box>
            </li>
          );
        }}
        renderInput={(p) => <TextField {...p} label={label} size={size} placeholder="เลือก หรือพิมพ์ชื่อใหม่" {...rest} />}
      />
      {value?.trim() ? (
        <Typography sx={{ fontSize: 12, mt: 0.5, color: match ? "success.main" : "text.secondary" }}>
          {match ? `สถานที่เดิม “${match.name}” · ${match.job_count} งาน` : "จะสร้างเป็นสถานที่ใหม่"}
        </Typography>
      ) : (
        helperText && <Typography sx={{ fontSize: 12, mt: 0.5, color: "text.secondary" }}>{helperText}</Typography>
      )}
    </Box>
  );
}
