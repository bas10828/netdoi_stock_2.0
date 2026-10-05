"use client";
import { useEffect, useState } from "react";

const EMPTY = { devices: [], sites: [], jobs: [] };

// Debounced search. results is null for an empty query, else { devices, sites, jobs };
// while a new query loads, the previous results stay on screen and loading is true.
export default function useDeviceSearch(q, { limit = 50, delay = 200 } = {}) {
  const text = q.trim();
  const [state, setState] = useState({ text: "", results: null });

  useEffect(() => {
    if (!text) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}&limit=${limit}`, { signal: ctrl.signal });
        const data = await res.json();
        setState({ text, results: res.ok ? { ...EMPTY, ...data } : EMPTY });
      } catch (err) {
        if (err.name !== "AbortError") setState({ text, results: EMPTY });
      }
    }, delay);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, limit, delay]);

  if (!text) return { text, results: null, loading: false };
  return { text, results: state.results, loading: state.text !== text };
}
