"use client";
import { useMemo, useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FilterListIcon from "@mui/icons-material/FilterList";
import { Pill } from "@/components/StatusBadge";

const COLUMNS = [
  { key: "name", label: "งาน" },
  { key: "delivered_on", label: "วันส่งงาน" },
  { key: "device_count", label: "อุปกรณ์", align: "right" },
  { key: "open_claims", label: "สถานะ" },
];

// Sort value per column; empty values always go last
const sortValue = {
  name: (j) => j.name.toLowerCase(),
  delivered_on: (j) => j.delivered_on ?? null,
  device_count: (j) => j.device_count,
  open_claims: (j) => j.open_claims,
};

function compare(a, b, key, dir) {
  const va = sortValue[key](a);
  const vb = sortValue[key](b);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const c = typeof va === "string" ? va.localeCompare(vb, "th") : va - vb;
  return dir === "asc" ? c : -c;
}

function Status({ job }) {
  return job.open_claims > 0 ? <Pill color="warning">กำลังเคลม {job.open_claims}</Pill> : <Pill color="success">ปกติ</Pill>;
}

// jobs: rows from getSite() plus date_text (formatted on the server)
export default function JobsTable({ jobs }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState({ key: "delivered_on", dir: "desc" });

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f
      ? jobs.filter((j) => [j.name, j.po_number, j.note, j.date_text].some((v) => v?.toLowerCase().includes(f)))
      : jobs;
    return [...list].sort((a, b) => compare(a, b, sort.key, sort.dir) || b.id - a.id);
  }, [jobs, filter, sort]);

  const sortBy = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <TextField
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ค้นหาชื่องาน, PO, หมายเหตุ, วันที่"
          size="small"
          sx={{ flex: "1 1 260px", maxWidth: { sm: 380 } }}
          slotProps={{
            htmlInput: { "aria-label": "ค้นหางาน" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {/* Phones have no table header, so sorting is a dropdown */}
        <TextField
          select
          size="small"
          label="เรียงตาม"
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":");
            setSort({ key, dir });
          }}
          sx={{ display: { sm: "none" }, minWidth: 180 }}
        >
          <MenuItem value="delivered_on:desc">วันส่งงาน ใหม่ → เก่า</MenuItem>
          <MenuItem value="delivered_on:asc">วันส่งงาน เก่า → ใหม่</MenuItem>
          <MenuItem value="name:asc">ชื่องาน ก → ฮ</MenuItem>
          <MenuItem value="device_count:desc">อุปกรณ์ มาก → น้อย</MenuItem>
          <MenuItem value="open_claims:desc">กำลังเคลมก่อน</MenuItem>
        </TextField>
        {filter.trim() && (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            พบ {shown.length} จาก {jobs.length} งาน
          </Typography>
        )}
      </Box>

      {/* Phones: one card per job */}
      <Box sx={{ display: { xs: "flex", sm: "none" }, flexDirection: "column", gap: 1 }}>
        {shown.map((j) => (
          <Card key={j.id} sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Link component={NextLink} href={`/jobs/${j.id}`} sx={{ flex: 1, minWidth: 0 }}>
                {j.name}
              </Link>
              <Status job={j} />
            </Box>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              ส่งงาน {j.date_text} · {j.device_count} อุปกรณ์{j.po_number ? ` · PO ${j.po_number}` : ""}
            </Typography>
          </Card>
        ))}
      </Box>

      <Card sx={{ display: { xs: "none", sm: "block" } }}>
        <TableContainer>
          <Table sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableCell key={c.key} align={c.align} sortDirection={sort.key === c.key ? sort.dir : false}>
                    <TableSortLabel
                      active={sort.key === c.key}
                      direction={sort.key === c.key ? sort.dir : "asc"}
                      onClick={() => sortBy(c.key)}
                    >
                      {c.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((j) => (
                <TableRow key={j.id} hover>
                  <TableCell>
                    <Link component={NextLink} href={`/jobs/${j.id}`}>
                      {j.name}
                    </Link>
                    {(j.po_number || j.note) && (
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                        {[j.po_number && `PO ${j.po_number}`, j.note].filter(Boolean).join(" · ")}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>{j.date_text}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{j.device_count}</TableCell>
                  <TableCell>
                    <Status job={j} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {shown.length === 0 && (
        <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>
          ไม่พบงานที่ตรงกับ “{filter.trim()}”
        </Typography>
      )}
    </Box>
  );
}
