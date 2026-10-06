// The warranty choices offered per brand+model group, and how a choice becomes a request group.
export const TERMS = [
  { value: "", label: "ไม่เปลี่ยน" },
  { value: "1", label: "1 ปี" },
  { value: "2", label: "2 ปี" },
  { value: "3", label: "3 ปี" },
  { value: "5", label: "5 ปี" },
  { value: "life", label: "Lifetime" },
  { value: "clear", label: "ล้างประกัน" },
];

// "3" -> { ids, years: 3 }, "life" -> { ids, lifetime: true }, "clear" -> { ids, clear: true }
export function termToGroup(value, ids) {
  if (value === "life") return { ids, lifetime: true };
  if (value === "clear") return { ids, clear: true };
  return { ids, years: Number(value) };
}

// A start date is only needed when some group gets an end date
export const needsStartDate = (values) => values.some((v) => v && v !== "life" && v !== "clear");
