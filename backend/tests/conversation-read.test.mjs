import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationReadPatch, isConversationHidden } from "../conversation-read.mjs";

const messages = [
  { id: "message-1", senderId: "partner", sentAt: "2026-09-03T00:00:01.000Z" },
  { id: "message-2", senderId: "me", sentAt: "2026-09-03T00:00:02.000Z" },
  { id: "message-3", senderId: "partner", sentAt: "2026-09-03T00:00:03.000Z" },
];

test("read patch clears unread when the returned snapshot is still current", () => {
  const patch = buildConversationReadPatch(
    {
      lastMessageId: "message-3",
      lastMessageAt: "2026-09-03T00:00:03.000Z",
      readAt: { partner: "2026-09-02T00:00:00.000Z" },
      unread: { me: 2, partner: 4 },
    },
    messages,
    "me",
  );

  assert.deepEqual(patch, {
    readAt: { partner: "2026-09-02T00:00:00.000Z", me: "2026-09-03T00:00:03.000Z" },
    unread: { me: 0, partner: 4 },
  });
});

test("read patch preserves messages that arrived after the returned snapshot", () => {
  const patch = buildConversationReadPatch(
    {
      lastMessageId: "message-4",
      lastMessageAt: "2026-09-03T00:00:04.000Z",
      readAt: { me: "2026-09-03T00:00:01.000Z" },
      unread: { me: 2 },
    },
    messages,
    "me",
  );

  // snapshot 안에서 새로 본 받은 메시지는 message-3 하나뿐이고, message-4는
  // snapshot 뒤에 도착했으므로 unread 1개가 남습니다.
  assert.deepEqual(patch, {
    readAt: { me: "2026-09-03T00:00:03.000Z" },
    unread: { me: 1 },
  });
});

test("already advanced or empty snapshots do not rewrite conversation state", () => {
  assert.equal(buildConversationReadPatch({ readAt: { me: messages[2].sentAt } }, messages, "me"), null);
  assert.equal(buildConversationReadPatch({ unread: { me: 2 } }, [], "me"), null);
});

test("conversation visibility is scoped to the current member and tolerates legacy documents", () => {
  assert.equal(isConversationHidden({ hiddenBy: ["me"] }, "me"), true);
  assert.equal(isConversationHidden({ hiddenBy: ["partner"] }, "me"), false);
  assert.equal(isConversationHidden({}, "me"), false);
  assert.equal(isConversationHidden({ hiddenBy: "me" }, "me"), false);
});
