import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createValidators, isDocumentId } from "../validate.mjs";

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
