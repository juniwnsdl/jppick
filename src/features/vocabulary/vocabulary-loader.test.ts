import { afterEach, describe, expect, it, vi } from "vitest";

import { clearVocabularyCache, loadVocabularyLevel } from "./vocabulary-loader";

const n1Word = {
  word: "言葉",
  reading: "ことば",
  pronunciationKo: "코토바",
  meaningKo: "말",
  level: "N1",
};

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  clearVocabularyCache();
});

describe("loadVocabularyLevel", () => {
  it("loads an N1 data file and accepts the complete runtime word shape", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      expect(url).toBe("/data/jlpt/n1.json");
      return jsonResponse([n1Word]);
    });

    await expect(loadVocabularyLevel("N1", fetcher)).resolves.toEqual([n1Word]);
  });

  it("reuses a successful level request from the cache", async () => {
    const fetcher = vi.fn(async () => jsonResponse([n1Word]));

    await loadVocabularyLevel("N1", fetcher);
    await loadVocabularyLevel("N1", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("loads separate files for separate levels", async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => jsonResponse([{
      ...n1Word,
      level: String(url).endsWith("n2.json") ? "N2" : "N1",
    }]));

    await loadVocabularyLevel("N1", fetcher);
    await loadVocabularyLevel("N2", fetcher);

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "/data/jlpt/n1.json",
      "/data/jlpt/n2.json",
    ]);
  });

  it("rejects malformed vocabulary payloads", async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ ...n1Word, meaningKo: 42 }]));

    await expect(loadVocabularyLevel("N1", fetcher)).rejects.toThrow("N1 단어 데이터를 불러오지 못했어요.");
  });

  it("does not retain a rejected request in the cache", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse([], false))
      .mockResolvedValueOnce(jsonResponse([n1Word]));

    await expect(loadVocabularyLevel("N1", fetcher)).rejects.toThrow("N1 단어 데이터를 불러오지 못했어요.");
    await expect(loadVocabularyLevel("N1", fetcher)).resolves.toEqual([n1Word]);
  });
});
