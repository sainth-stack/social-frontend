"use client";

import { use } from "react";

import PostDetail from "@/components/social-media/posts/PostDetail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PostDetail postId={id} />;
}
