import { Suspense } from "react";
import NewClaimForm from "./NewClaimForm";

export const metadata = { title: "ส่งเคลม" };

export default function NewClaimPage() {
  return (
    <Suspense>
      <NewClaimForm />
    </Suspense>
  );
}
