import EmptyState from "@/components/EmptyState";
import { LinkButton } from "@/components/Links";

export default function NotFound() {
  return (
    <EmptyState
      title="ไม่พบหน้านี้"
      description="ข้อมูลอาจถูกลบ หรือลิงก์ไม่ถูกต้อง"
      action={<LinkButton href="/" variant="outlined">กลับหน้าค้นหา</LinkButton>}
    />
  );
}
