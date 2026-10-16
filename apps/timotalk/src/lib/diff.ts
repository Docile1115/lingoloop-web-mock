/**
 * 교정 전후 문장의 차이. 고친 부분만 눈에 띄게 그리려고 씁니다(노트·대화방·복습).
 *
 * 띄어 쓰는 말(한국어·영어 등)은 낱말 단위로, 띄어 쓰지 않는 말(일본어·중국어)은 글자 단위로 나눕니다.
 * 사람이 고친 짧은 문장용이라 최장 공통 부분열(LCS)을 그대로 계산합니다(너무 길면 통째로 바뀐 것으로 봅니다).
 */
export type Segment = { text: string; kind: "same" | "removed" | "added" };

function tokens(text: string): string[] {
  return /\s/.test(text.trim()) ? (text.match(/\S+\s*/g) ?? []) : [...text];
}

function push(list: Segment[], text: string, kind: Segment["kind"]) {
  const last = list[list.length - 1];
  if (last && last.kind === kind) last.text += text;
  else list.push({ text, kind });
}

export function diffSentences(before: string, after: string): { before: Segment[]; after: Segment[] } {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length * b.length > 40_000) {
    return { before: [{ text: before, kind: "removed" }], after: [{ text: after, kind: "added" }] };
  }
  const same = (x: string, y: string) => x.trim() === y.trim();
  // lcs[i][j]: a[i..], b[j..] 의 공통 부분열 길이
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = same(a[i], b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const left: Segment[] = [];
  const right: Segment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (same(a[i], b[j])) {
      push(left, a[i], "same");
      push(right, b[j], "same");
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(left, a[i], "removed");
      i += 1;
    } else {
      push(right, b[j], "added");
      j += 1;
    }
  }
  while (i < a.length) push(left, a[i++], "removed");
  while (j < b.length) push(right, b[j++], "added");
  return { before: left, after: right };
}
