import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { readSaveData, writeSaveData } from "@/lib/save-data";

const SaveDataContext = createContext<{ on: boolean; toggle: () => void }>({
  on: false,
  toggle: () => undefined,
});

export function SaveDataProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const next = readSaveData();
    setOn(next);
    document.documentElement.dataset["saveData"] = next ? "on" : "off";
  }, []);

  function toggle() {
    const next = !on;
    writeSaveData(next);
    setOn(next);
    document.documentElement.dataset["saveData"] = next ? "on" : "off";
  }

  return <SaveDataContext.Provider value={{ on, toggle }}>{children}</SaveDataContext.Provider>;
}

export function useSaveData() {
  return useContext(SaveDataContext);
}
