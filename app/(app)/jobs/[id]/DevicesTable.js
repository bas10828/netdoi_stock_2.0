"use client";
import { useMemo, useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import FilterListIcon from "@mui/icons-material/FilterList";
import StatusBadge from "@/components/StatusBadge";
import { STATUS, searchKey } from "@/lib/format";
import { fontMono } from "@/lib/fonts";

const mono = { fontFamily: fontMono, fontSize: 13 };

export default function DevicesTable({ devices }) {
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const counts = useMemo(() => {
    const c = { all: devices.length, ok: 0, claim: 0, replaced: 0 };
    devices.forEach((d) => (c[d.status] += 1));
    return c;
  }, [devices]);

  const shown = useMemo(() => {
    const text = filter.trim().toLowerCase();
    const key = searchKey(filter);
    return devices.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!text) return true;
      return (
        (key && (searchKey(d.serial).includes(key) || searchKey(d.mac).includes(key))) ||
        [d.brand, d.model, d.device_type, d.device_name, d.location, d.ip].some((v) => v?.toLowerCase().includes(text))
      );
    });
  }, [devices, filter, status]);

  const pageRows = shown.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <TextField
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
          placeholder="กรอง serial, MAC, รุ่น, ตำแหน่ง"
          size="small"
          sx={{ flex: "1 1 260px", maxWidth: { sm: 360 } }}
          slotProps={{
            htmlInput: { "aria-label": "กรองอุปกรณ์" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_, v) => {
            if (v) {
              setStatus(v);
              setPage(0);
            }
          }}
          aria-label="กรองตามสถานะ"
          sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { textTransform: "none", px: 1.5, borderColor: "divider" } }}
        >
          <ToggleButton value="all">ทั้งหมด {counts.all}</ToggleButton>
          {Object.entries(STATUS).map(([key, s]) =>
            counts[key] > 0 ? (
              <ToggleButton key={key} value={key}>
                {s.label} {counts[key]}
              </ToggleButton>
            ) : null
          )}
        </ToggleButtonGroup>
      </Box>

      {/* Phones: one card per device */}
      <Box sx={{ display: { xs: "flex", sm: "none" }, flexDirection: "column", gap: 1 }}>
        {pageRows.map((d) => (
          <Box
            key={d.id}
            component={NextLink}
            href={`/devices/${d.id}`}
            sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 1.75, border: 1, borderColor: "divider", borderRadius: 2.5, bgcolor: "background.paper", color: "text.primary", textDecoration: "none" }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Typography sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}>{[d.brand, d.model].filter(Boolean).join(" ") || "—"}</Typography>
              <StatusBadge status={d.status} />
            </Box>
            <Typography sx={{ ...mono, color: "primary.main" }}>{d.serial || "ไม่มี serial"}</Typography>
            {d.mac && <Typography sx={{ ...mono, color: "text.secondary" }}>{d.mac}</Typography>}
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {[d.device_type, d.device_name, d.location].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
        ))}
        {pageRows.length === 0 && (
          <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง</Typography>
        )}
      </Box>

      <Card sx={{ display: { xs: shown.length > 25 ? "block" : "none", sm: "block" }, "& .MuiTableContainer-root": { display: { xs: "none", sm: "block" } } }}>
        <TableContainer>
          <Table sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell>อุปกรณ์</TableCell>
                <TableCell>Serial</TableCell>
                <TableCell>MAC</TableCell>
                <TableCell>ตำแหน่ง</TableCell>
                <TableCell>สถานะ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500 }}>
                      {[d.brand, d.model].filter(Boolean).join(" ") || "—"}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      {[d.device_type, d.device_name].filter(Boolean).join(" · ")}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Link component={NextLink} href={`/devices/${d.id}`} sx={mono}>
                      {d.serial || "ไม่มี serial"}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ ...mono, color: "text.secondary", whiteSpace: "nowrap" }}>{d.mac || "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    {d.location || "—"}
                    {d.ip && <Typography sx={{ ...mono, fontSize: 12, color: "text.secondary" }}>{d.ip}</Typography>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: "center", color: "text.secondary", py: 5 }}>
                    ไม่พบอุปกรณ์ที่ตรงกับตัวกรอง
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {shown.length > 25 && (
          <TablePagination
            component="div"
            count={shown.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
            labelRowsPerPage="ต่อหน้า"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} จาก ${count}`}
            sx={{ borderTop: 1, borderColor: "divider" }}
          />
        )}
      </Card>
    </Box>
  );
}
