import { useEffect, useRef, useState } from "react";
import { emptyData, uid, type Data } from "./model";
import { checkData, db, readData, writeData } from "./storage";
import { checkActiveResourceChanges } from "./engine";
export type Commit = (next: Data, description: string) => Promise<boolean>;
export function useStore() {
  const [data, setData] = useState<Data>(emptyData),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Loading local records…");
  const revision = useRef(""),
    current = useRef(data),
    busy = useRef(false),
    past = useRef<Data[]>([]),
    future = useRef<Data[]>([]);
  useEffect(() => {
    let active = true;
    readData()
      .then((result) => {
        if (active) {
          revision.current = result.revision;
          current.current = result.data;
          setData(result.data);
          setReady(true);
          setStatus("Saved on this browser");
        }
      })
      .catch((e) => {
        if (active)
          setError(
            `Unable to open local storage: ${e.message}. Export an existing backup before clearing browser data.`,
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(
    next: Data,
    description: string,
    mode: "normal" | "undo" | "redo" | "replace" = "normal",
  ) {
    if (busy.current) {
      setError("A save is already in progress. Try again in a moment.");
      return false;
    }
    busy.current = true;
    setError("");
    setStatus("Saving…");
    try {
      checkData(next);
      if (mode === "normal") checkActiveResourceChanges(current.current, next);
      for (const term of (mode === "normal"
        ? current.current.semesters
        : []
      ).filter(
        (t) =>
          t.finalized &&
          next.semesters.some((n) => n.id === t.id && n.finalized),
      )) {
        const extract = (d: Data) => {
          const offerings = d.offerings.filter((o) => o.semesterId === term.id),
            ids = new Set(offerings.map((o) => o.id));
          return JSON.stringify({
            offerings,
            teachingGroups: d.teachingGroups.filter((g) =>
              ids.has(g.offeringId),
            ),
            loadActivities: d.loadActivities.filter(
              (a) => a.semesterId === term.id,
            ),
            assignments: d.assignments.filter((a) => ids.has(a.offeringId)),
            meetings: d.meetings.filter((m) => ids.has(m.offeringId)),
          });
        };
        if (extract(next) !== extract(current.current))
          throw new Error(
            "Reopen the finalized semester in Settings before editing its schedules.",
          );
      }
      const saved = {
        ...next,
        history: [
          { id: uid(), at: new Date().toISOString(), description },
          ...current.current.history,
        ].slice(0, 250),
      };
      revision.current = await writeData(saved, revision.current);
      if (mode === "normal" || mode === "replace") {
        past.current = [...past.current.slice(-19), current.current];
        future.current = [];
      }
      current.current = saved;
      setData(saved);
      setStatus("Saved on this browser");
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Storage failed. Changes were not saved.",
      );
      setStatus("Not saved · review error");
      return false;
    } finally {
      busy.current = false;
    }
  }
  async function undo() {
    const previous = past.current.at(-1);
    if (previous) {
      const before = current.current;
      if (await save(previous, "Undid last change", "undo")) {
        past.current.pop();
        future.current.push(before);
        setData({ ...current.current });
      }
    }
  }
  async function redo() {
    const next = future.current.at(-1);
    if (next) {
      const before = current.current;
      if (await save(next, "Redid last change", "redo")) {
        future.current.pop();
        past.current.push(before);
        setData({ ...current.current });
      }
    }
  }
  return {
    data,
    ready,
    error,
    setError,
    status,
    commit: save as Commit,
    replace: ((next: Data, description: string) =>
      save(next, description, "replace")) as Commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    db,
  };
}
