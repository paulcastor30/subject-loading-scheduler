import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
const prefix = "slss-draft-v1:";
const event = "slss-drafts-changed";
const discardEvent = "slss-draft-discarded";
type Envelope<T> = { value: T; baseline: T; label: string; href: string };
function read<T>(key: string): Envelope<T> | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + key) ?? "null");
    return value &&
      typeof value === "object" &&
      "value" in value &&
      "baseline" in value &&
      typeof value.label === "string" &&
      typeof value.href === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
function announce() {
  window.dispatchEvent(new Event(event));
}
export function useDraft<T>(
  key: string,
  initial: T | (() => T),
  label: string,
  href: string,
) {
  const initialRef = useRef<T>(
    typeof initial === "function" ? (initial as () => T)() : initial,
  );
  const [state, setState] = useState(
    () =>
      read<T>(key) ?? {
        value: initialRef.current,
        baseline: initialRef.current,
        label,
        href,
      },
  );
  const dirty = JSON.stringify(state.value) !== JSON.stringify(state.baseline);
  const fresh = typeof initial === "function" ? initialRef.current : initial;
  const signature = JSON.stringify(fresh);
  useEffect(() => {
    if (!dirty && JSON.stringify(state.baseline) !== signature) {
      const next = JSON.parse(signature) as T;
      setState({ value: next, baseline: next, label, href });
    }
  }, [dirty, signature, state.baseline, label, href]);
  useEffect(() => {
    const discard = (e: Event) => {
      if ((e as CustomEvent<string>).detail === key)
        setState({
          value: initialRef.current,
          baseline: initialRef.current,
          label,
          href,
        });
    };
    window.addEventListener(discardEvent, discard);
    return () => window.removeEventListener(discardEvent, discard);
  }, [key, label, href]);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      if (dirty)
        sessionStorage.setItem(
          prefix + key,
          JSON.stringify({ ...state, label, href }),
        );
      else sessionStorage.removeItem(prefix + key);
      setStorageError(false);
    } catch {
      setStorageError(dirty);
    }
    announce();
  }, [key, state, dirty, label, href]);
  const setValue: Dispatch<SetStateAction<T>> = (value) =>
    setState((old) => ({
      ...old,
      value:
        typeof value === "function"
          ? (value as (old: T) => T)(old.value)
          : value,
    }));
  function clear(value: T = initialRef.current) {
    try {
      sessionStorage.removeItem(prefix + key);
    } catch {
      /* The on-screen form still works. */
    }
    setState({ value, baseline: value, label, href });
    announce();
  }
  return { value: state.value, setValue, clear, dirty, storageError };
}
export function discardDraft(key: string) {
  try {
    sessionStorage.removeItem(prefix + key);
  } catch {
    /* The visible form will reset below. */
  }
  window.dispatchEvent(new CustomEvent(discardEvent, { detail: key }));
  announce();
}
export function draftList(): { key: string; label: string; href: string }[] {
  try {
    return Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .flatMap((key) => {
        const item = read<unknown>(key.slice(prefix.length));
        return item &&
          JSON.stringify(item.value) !== JSON.stringify(item.baseline)
          ? [
              {
                key: key.slice(prefix.length),
                label: item.label,
                href: item.href,
              },
            ]
          : [];
      });
  } catch {
    return [];
  }
}
export function useDraftList() {
  const [drafts, setDrafts] = useState(draftList);
  useEffect(() => {
    const update = () => setDrafts(draftList());
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (draftList().length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener(event, update);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener(event, update);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
  return drafts;
}
