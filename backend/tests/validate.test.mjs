import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createValidators, isDocumentId, isMediaDataUri, MEDIA_MAX_LENGTH, normalizedIsoTimestamp } from "../validate.mjs";

class TestApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("document ids accept every id format the server issues", () => {
  const ids = [
    "Xy3kQ9vLm2PzR7tB1nW4sD8fH6jA", // Identity Platform uid (28 chars)
    "post-" + crypto.randomUUID(),
    "reply-" + crypto.randomUUID(),
    "saved-" + crypto.randomUUID(),
    "report-" + crypto.randomUUID(),
    "message-" + crypto.randomUUID(),
    "mobile-1760000000000-k3j9x0a1", // mobile clientMessageId
    "conversation-" + sha256("a:b").slice(0, 24),
    sha256("notification").slice(0, 40), // notifications, home entries
    sha256("home report"), // home reports (64 hex)
    "frame",
    "frame2",
    "whiteboard",
  ];
  for (const id of ids) assert.equal(isDocumentId(id), true, id);
  assert.equal(isDocumentId(sha256("n").slice(0, 40), { min: 40, max: 40 }), true);
  assert.equal(isDocumentId("p1", { min: 1 }), true);
});

test("document ids reject nested paths, dot segments, reserved names and junk", () => {
  const rejected = [
    "a/b",
    "p1/replies/r1",
    decodeURIComponent("p1%2Freplies%2Fr1"), // Express 5 decodes %2F in params
    decodeURIComponent("%2F%2F%2F%2F"),
    "posts/../profiles/x",
    "..",
    ".",
    "....",
    "",
    "abc", // shorter than the default minimum
    "a".repeat(129),
    "__name__",
    "__abcd__",
    "with space",
    " padded ",
    "line\nbreak",
    "percent%2Fliteral",
    "가나다라",
    "emoji😀😀",
    null,
    undefined,
    1234,
    ["abcd"],
    { id: "abcd" },
  ];
  for (const value of rejected) assert.equal(isDocumentId(value), false, JSON.stringify(value));
  assert.equal(isDocumentId(sha256("n").slice(0, 39), { min: 40, max: 40 }), false);
  assert.equal(isDocumentId("", { min: 0 }), false, "an empty id never addresses a document");
});

test("docId throws a 422 VALIDATION_ERROR naming the field", () => {
  const { docId, optionalDocId } = createValidators(TestApiError);
  assert.equal(docId("post-123", "postId"), "post-123");
  for (const value of ["a/b", "..", "", undefined, "__name__"]) {
    assert.throws(
      () => docId(value, "postId"),
      (error) =>
        error instanceof TestApiError &&
        error.status === 422 &&
        error.code === "VALIDATION_ERROR" &&
        error.details.field === "postId",
    );
  }
  assert.equal(optionalDocId(undefined, "parentId"), "");
  assert.equal(optionalDocId(null, "parentId"), "");
  assert.equal(optionalDocId("", "parentId"), "");
  assert.equal(optionalDocId("reply-1", "parentId"), "reply-1");
  assert.throws(() => optionalDocId("x/y", "parentId"), { status: 422, code: "VALIDATION_ERROR" });
  assert.throws(() => optionalDocId(42, "parentId"), { status: 422 });
});

test("media accepts only the image and audio data URIs clients produce", () => {
  const images = [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==",
    "data:image/png;base64,iVBORw0KGgo=",
    "data:image/webp;base64,UklGRiQAAABXRUJQ",
  ];
  for (const value of images) assert.equal(isMediaDataUri(value, "image"), true, value);

  const audio = [
    "data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibQ==", // Chrome MediaRecorder
    "data:audio/ogg; codecs=opus;base64,T2dnUwACAAAAAAAAAAA=", // Firefox MediaRecorder
    "data:audio/mp4;base64,AAAAHGZ0eXBNNEEg", // Safari, iOS app
    "data:audio/3gpp;base64,AAAAGGZ0eXAzZ3A0", // Android app
    "data:audio/webm;base64,GkXfo59C", // expo-audio on web, MediaRecorder fallback type
    "data:audio/x-m4a;base64,AAAAHGZ0eXBNNEEg",
    "data:audio/aac;base64,//FQgA==",
    'data:audio/mp4;codecs="mp4a.40.2";base64,AAAA',
  ];
  for (const value of audio) assert.equal(isMediaDataUri(value, "audio"), true, value);
});

test("media rejects remote URLs, scriptable types and malformed payloads", () => {
  const rejectedImages = [
    "https://tracker.example/pixel.gif",
    "http://tracker.example/pixel.png",
    "//tracker.example/pixel.png",
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    "data:text/html;base64,PHNjcmlwdD4=",
    "javascript:alert(1)",
    "data:image/jpeg;base64,",
    "data:image/jpeg,raw-bytes",
    "data:image/jpeg;base64,AAAA BBBB",
    "data:image/jpeg;base64,AAAA\nBBBB",
    'data:image/jpeg;base64,AAAA"onerror="x',
    "data:image/jpeg;base64,AAAA#https://tracker.example/",
    " data:image/jpeg;base64,AAAA",
    "data:image/png;base64," + "A".repeat(MEDIA_MAX_LENGTH),
    "data:audio/webm;base64,GkXf",
  ];
  for (const value of rejectedImages) assert.equal(isMediaDataUri(value, "image"), false, value.slice(0, 60));

  const rejectedAudio = [
    "https://cdn.example/voice.mp3",
    "data:audio/wav;base64,UklGRg==",
    "data:audio/mpeg;base64,SUQz",
    "data:audio/webm;codecs=opus",
    "data:audio/webm;codecs=opus;foo=bar;base64,AAAA",
    "data:audio/webm;codecs=<script>;base64,AAAA",
    "data:audio/webm;charset=utf-8;base64,AAAA",
    "data:image/png;base64,iVBORw0KGgo=",
    "data:audio/webm;base64,AA%AA",
  ];
  for (const value of rejectedAudio) assert.equal(isMediaDataUri(value, "audio"), false, value);

  assert.equal(isMediaDataUri("data:video/mp4;base64,AAAA", "video"), false);
  assert.equal(isMediaDataUri(null, "image"), false);
  const prefix = "data:image/png;base64,";
  assert.equal(isMediaDataUri(prefix + "A".repeat(MEDIA_MAX_LENGTH - prefix.length), "image"), true);
  assert.equal(isMediaDataUri(prefix + "A".repeat(MEDIA_MAX_LENGTH - prefix.length + 1), "image"), false);
});

test("message polling cursors accept stored sentAt values and normalize precision", () => {
  const stored = new Date(Date.UTC(2026, 9, 10, 12, 34, 56, 789)).toISOString();
  assert.equal(normalizedIsoTimestamp(stored), stored);
  // 그대로 문자열 비교하면 "…:56Z" > "…:56.789Z" 라서 같은 초의 메시지를 건너뜁니다.
  assert.equal(normalizedIsoTimestamp("2026-10-10T12:34:56Z"), "2026-10-10T12:34:56.000Z");
  assert.equal(normalizedIsoTimestamp("2026-10-10T12:34:56.7Z"), "2026-10-10T12:34:56.700Z");
  for (const value of [
    "2026-10-10T12:34:56+09:00",
    "2026-10-10T12:34:56 09:00",
    "2026-10-10 12:34:56Z",
    "2026-10-10",
    "2026-02-30T00:00:00Z",
    "2026-10-10T24:00:00Z",
    "2026-10-10T12:34:56.7890Z",
    " 2026-10-10T12:34:56Z",
    "1791635696789",
    "",
    undefined,
    null,
    1791635696789,
    ["2026-10-10T12:34:56Z"],
  ]) {
    assert.equal(normalizedIsoTimestamp(value), null, JSON.stringify(value));
  }
  const { isoTimestamp } = createValidators(TestApiError);
  assert.equal(isoTimestamp("2026-10-10T12:34:56Z", "after"), "2026-10-10T12:34:56.000Z");
  assert.throws(() => isoTimestamp("yesterday", "after"), { status: 422, code: "VALIDATION_ERROR" });
});

test("mediaDataUri keeps empty attachments optional and reports the field on rejection", () => {
  const { mediaDataUri } = createValidators(TestApiError);
  for (const empty of [undefined, null, "", "   "]) assert.equal(mediaDataUri(empty, "imageUrl", "image"), "");
  assert.equal(mediaDataUri(" data:image/png;base64,iVBORw0KGgo= ", "imageUrl", "image"), "data:image/png;base64,iVBORw0KGgo=");
  for (const [value, field, kind] of [
    ["https://tracker.example/a.png", "imageUrl", "image"],
    ["https://tracker.example/a.mp3", "audioUrl", "audio"],
    ["data:image/png;base64,iVBORw0KGgo=", "media", "audio"],
    [42, "media", "image"],
    ["data:image/png;base64," + "A".repeat(MEDIA_MAX_LENGTH), "imageUrl", "image"],
  ]) {
    assert.throws(
      () => mediaDataUri(value, field, kind),
      (error) => error.status === 422 && error.code === "VALIDATION_ERROR" && error.details.field === field,
    );
  }
});
