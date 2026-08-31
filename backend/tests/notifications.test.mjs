import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotification,
  notificationDocumentId,
  notificationExcerpt,
} from "../notifications.mjs";

test("notification ids are deterministic and separated by event identity", () => {
  const base = { type: "post_like", recipientId: "user-owner", actorId: "user-reader", sourceId: "post-1" };
  assert.equal(notificationDocumentId(base), notificationDocumentId(base));
  assert.notEqual(notificationDocumentId(base), notificationDocumentId({ ...base, actorId: "user-other" }));
  assert.match(notificationDocumentId(base), /^[a-f0-9]{40}$/);
});

test("notification records suppress self activity and normalize excerpts", () => {
  assert.equal(
    buildNotification({
      type: "post_reply",
      recipientId: "same-user",
      actorId: "same-user",
      sourceId: "reply-1",
      createdAt: "2026-08-31T00:00:00.000Z",
    }),
    null,
  );

  const record = buildNotification({
    type: "post_reply",
    recipientId: "owner",
    actorId: "reader",
    sourceId: "reply-1",
    postId: "post-1",
    replyId: "reply-1",
    excerpt: `  hello\n\n${"a".repeat(200)}  `,
    createdAt: "2026-08-31T00:00:00.000Z",
  });
  assert.equal(record.recipientId, "owner");
  assert.equal(record.readAt, null);
  assert.equal(record.excerpt.length, 160);
  assert.ok(record.excerpt.endsWith("…"));
  assert.equal(notificationExcerpt(" one\n two "), "one two");
});

test("unsupported notification types are rejected", () => {
  assert.throws(
    () => notificationDocumentId({ type: "arbitrary", recipientId: "a", actorId: "b", sourceId: "c" }),
    /Unsupported notification type/,
  );
});
