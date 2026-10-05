import { useCallback, useRef, useState } from "react";
import { loadState, saveState } from "./lib/storage.js";
import { ensureWeekSnap } from "./lib/report.js";
import { dkey } from "./lib/dates.js";

/**
 * Estado de la app guardado en el dispositivo. update(fn) clona el estado, deja que fn lo modifique
 * y muestra como avisos los mensajes que fn devuelva.
 */
export function useStore(onMessages) {
  const [state, setState] = useState(loadState);
  const ref = useRef(state);
  const update = useCallback(fn => {
    const draft = structuredClone(ref.current);
    ensureWeekSnap(draft, dkey());
    const msgs = fn(draft) || [];
    draft.updatedAt = Date.now();
    ref.current = draft;
    saveState(draft);
    setState(draft);
    if (msgs.length && onMessages) onMessages(msgs);
  }, [onMessages]);
  const replace = useCallback(next => { ref.current = next; saveState(next); setState(next); }, []);
  return [state, update, replace];
}
