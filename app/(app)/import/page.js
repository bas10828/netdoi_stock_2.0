import { Suspense } from "react";
import ImportForm from "./ImportForm";

export const metadata = { title: "Import Inventory" };

export default function ImportPage() {
  return (
    <Suspense>
      <ImportForm />
    </Suspense>
  );
}
