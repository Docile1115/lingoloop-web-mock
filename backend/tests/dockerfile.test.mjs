import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * API 이미지는 파일을 하나씩 골라 복사합니다(backend/Dockerfile). 새 모듈을 만들고 여기 빠뜨리면
 * 테스트는 모두 통과하는데 배포된 서버만 시작하지 못합니다 — 그래서 import 를 따라가 확인합니다.
 */
test("서버가 불러오는 로컬 모듈은 모두 API 이미지에 복사된다", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const copied = new Set(
    dockerfile
      .split("\n")
      .filter((line) => line.startsWith("COPY") && line.includes(".mjs"))
      .flatMap((line) => line.split(/\s+/))
      .filter((word) => word.endsWith(".mjs")),
  );
  const seen = new Set();
  const visit = async (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/from\s+["']\.\/([\w-]+\.mjs)["']/g)) await visit(match[1]);
  };
  await visit("server.mjs");
  const missing = [...seen].filter((file) => !copied.has(file));
  assert.deepEqual(missing, [], `backend/Dockerfile 의 COPY 에 빠진 모듈: ${missing.join(", ")}`);
});
