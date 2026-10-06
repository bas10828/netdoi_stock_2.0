import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { formatDate } from "@/lib/format";
import DeleteQuoteButton from "./DeleteQuoteButton";

const baht = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const money = (n) => (n === null || n === undefined ? "—" : baht.format(n));
const COLS = { xs: "1fr auto", md: "minmax(0, 3fr) 70px 60px 110px 120px" };

// What was quoted for this job (from the quotation files), not what was invoiced. Shown on the web page only;
// the Excel export is the inventory report given to the customer and carries no prices.
export default function QuotesPanel({ quotes }) {
  if (quotes.length === 0) return null;
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h2">ใบเสนอราคา / ประมาณการ</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
        ตามที่เสนอไว้ในเอกสาร อาจต่างจากที่ติดตั้งและเรียกเก็บจริง · ราคาไม่ครบทุกบรรทัด
      </Typography>
      {quotes.map((q) => {
        const total = q.items.reduce((s, i) => s + (i.amount ?? 0), 0);
        const priced = q.items.filter((i) => i.amount !== null).length;
        let lastSection;
        return (
          <Card key={q.id} sx={{ mb: 2 }}>
            <Box sx={{ px: 2, py: 1.5, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "baseline", borderBottom: 1, borderColor: "divider" }}>
              <Typography sx={{ fontWeight: 600 }}>{[q.kind, q.doc_no].filter(Boolean).join(" ")}</Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary", flex: 1, minWidth: 0 }}>
                {[q.doc_date && formatDate(q.doc_date), q.customer && `ถึง ${q.customer}`, q.source_file].filter(Boolean).join(" · ")}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                รวม {money(total)} บาท
                <Typography component="span" sx={{ fontSize: 12, color: "text.secondary", fontWeight: 400 }}>
                  {" "}ก่อน VAT · {priced}/{q.items.length} บรรทัดมีราคา
                </Typography>
              </Typography>
              <DeleteQuoteButton quoteId={q.id} />
            </Box>
            <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: COLS, gap: 2, px: 2, py: 1, color: "text.secondary", fontSize: 12.5 }}>
              <span>รายการ</span>
              <span style={{ textAlign: "right" }}>จำนวน</span>
              <span>หน่วย</span>
              <span style={{ textAlign: "right" }}>ราคา/หน่วย</span>
              <span style={{ textAlign: "right" }}>รวม</span>
            </Box>
            {q.items.map((i) => {
              const heading = i.section !== lastSection ? i.section : null;
              lastSection = i.section;
              return (
                <Box key={i.line_no}>
                  {heading && (
                    <Typography sx={{ px: 2, py: 0.75, fontSize: 13, fontWeight: 600, bgcolor: "action.hover", borderTop: 1, borderColor: "divider" }}>
                      {heading}
                    </Typography>
                  )}
                  <Box sx={{ display: "grid", gridTemplateColumns: COLS, gap: { xs: 0.25, md: 2 }, px: 2, py: 1, borderTop: 1, borderColor: "divider", alignItems: "baseline" }}>
                    <Typography sx={{ fontSize: 14, overflowWrap: "anywhere", gridColumn: { xs: "1 / -1", md: "auto" } }}>{i.description}</Typography>
                    <Typography sx={{ fontSize: 13, textAlign: { md: "right" } }}>{money(i.qty)}</Typography>
                    <Typography sx={{ fontSize: 13, color: "text.secondary", display: { xs: "none", md: "block" } }}>{i.unit}</Typography>
                    <Typography sx={{ fontSize: 13, textAlign: "right", display: { xs: "none", md: "block" } }}>{money(i.unit_price)}</Typography>
                    <Typography sx={{ fontSize: 13, textAlign: "right", fontWeight: 500 }}>{money(i.amount)}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Card>
        );
      })}
    </Box>
  );
}
