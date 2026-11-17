const KEY = "gk-save-data";

/** Stored choice wins. With no choice, follow the browser's data-saver flag. */
export function saveDataChoice(stored: string | null, connectionSave: boolean | undefined) {
  if (stored === "1") return true;
  if (stored === "0") return false;
  return connectionSave === true;
}

export function readSaveData() {
  if (typeof localStorage === "undefined") return false;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    return false;
  }
  const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
  return saveDataChoice(stored, connection.connection?.saveData);
}

export function writeSaveData(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* This visit still keeps the choice in memory. */
  }
}
