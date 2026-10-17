/**
 * 커뮤니티 서버 경로(backend/server.mjs). 글·댓글·교정·좋아요·삭제.
 *  - 글은 최신 100개 중 내가 볼 수 있는 50개(공개 글 + 내 글 + 대화 상대만 보는 글)를 받습니다.
 *  - 교정은 "고친 문장(text) + 고치기 전 문장(original)"을 든 댓글입니다(kind: "correction").
 */
import { api } from "@/lib/api";
import type { Post, PostReply } from "@/lib/types";

const path = (id: string) => `/api/posts/${encodeURIComponent(id)}`;

export const listPosts = () => api<Post[]>("/api/posts");
export const getPost = (id: string) => api<Post>(path(id));
export const listReplies = (id: string) => api<PostReply[]>(`${path(id)}/replies`);
export const deletePost = (id: string) => api(path(id), { method: "DELETE" });
export const setLiked = (id: string, liked: boolean) => api<{ liked: boolean; likes: number }>(`${path(id)}/like`, { body: { liked } });

export const addReply = (id: string, reply: { text: string; kind?: "reply" | "correction"; original?: string; parentId?: string }) =>
  api<PostReply>(`${path(id)}/replies`, { body: reply });

export type NewPost = {
  text: string;
  language: string;
  requestCorrection: boolean;
  visibility: "public" | "partners";
  imageUrl?: string;
};

export const createPost = (post: NewPost) => api<Post>("/api/posts", { body: post, slow: Boolean(post.imageUrl) });

/**
 * 글을 문장으로 나눕니다(교정할 문장 고르기). 마침표·물음표·느낌표(일본어·중국어 문장부호 포함)와 줄바꿈에서 끊습니다.
 * 서버는 고칠 문장을 1000자까지 받으므로 그보다 긴 덩어리는 잘라 둡니다.
 */
export function splitSentences(text: string): string[] {
  const pieces = text.match(/[^.!?。！？\n]+[.!?。！？]*/g) ?? [];
  return [...new Set(pieces.map((piece) => piece.trim().slice(0, 1000)).filter(Boolean))];
}
