"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { BoardDetailPage } from "../../../components/boards/BoardDetailPage";
import type { User as UserType } from "@supabase/supabase-js";

export default function BoardPage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        router.push("/auth/login");
        return;
      }
      setUser(user);
      setIsLoading(false);
    };

    getUser();
  }, [router, supabase.auth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const boardId = params.id as string;

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(boardId)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Invalid Board ID
          </h1>
          <p className="text-gray-600 mb-4">The board ID format is invalid.</p>
          <button
            onClick={() => router.push("/boards")}
            className="text-blue-600 hover:text-blue-800"
          >
            Back to Boards
          </button>
        </div>
      </div>
    );
  }

  return <BoardDetailPage boardId={boardId} currentUser={user} />;
}
