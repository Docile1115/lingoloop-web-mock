/**
 * 앱: 앱 문서 폴더의 JSON 파일(expo-file-system). 앱을 지우면 함께 사라집니다.
 */
import { File, Paths } from "expo-file-system";

const fileFor = (key: string) => new File(Paths.document, `timotalk-${key.replace(/[^a-z0-9-]/gi, "")}.json`);

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const file = fileFor(key);
    return file.exists ? (JSON.parse(await file.text()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    const file = fileFor(key);
    if (!file.exists) file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify(value));
  } catch {
    // 저장하지 못해도 화면은 계속 씁니다.
  }
}
