/**
 * Datasets locales en JSONL (un fichero por dataset). Las escrituras se serializan por fichero para
 * que líneas concurrentes no se entremezclen.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { DatasetName, DatasetSink } from "../app/ports.js";

export function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(1)) : resolve(path);
}

export class JsonlDatasetSink implements DatasetSink {
  private readonly directory: string;
  private ready: Promise<string | undefined> | null = null;
  private readonly tails = new Map<DatasetName, Promise<void>>();

  constructor(dataDir: string) {
    this.directory = expandHome(dataDir);
  }

  append(dataset: DatasetName, record: unknown): Promise<void> {
    this.ready ??= mkdir(this.directory, { recursive: true });
    const line = `${JSON.stringify(record)}\n`;
    const previous = this.tails.get(dataset) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await this.ready;
        await appendFile(join(this.directory, `${dataset}.jsonl`), line, "utf8");
      });
    this.tails.set(dataset, next);
    return next;
  }
}
