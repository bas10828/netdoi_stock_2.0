"use client";
import { createContext, useCallback, useContext, useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import SnackbarContent from "@mui/material/SnackbarContent";

const ToastContext = createContext(() => {});

// const toast = useToast(); toast("บันทึกแล้ว") or toast("ผิดพลาด", { error: true })
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, options = {}) => {
    setToast({ message, error: !!options.error, key: Date.now() });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        key={toast?.key}
        open={!!toast}
        autoHideDuration={toast?.error ? 8000 : 4000}
        onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <SnackbarContent
          message={toast?.message}
          role={toast?.error ? "alert" : "status"}
          sx={{
            borderRadius: 2.5,
            fontWeight: 500,
            bgcolor: toast?.error ? "error.main" : "text.primary",
            color: toast?.error ? "error.contrastText" : "background.paper",
          }}
        />
      </Snackbar>
    </ToastContext.Provider>
  );
}
