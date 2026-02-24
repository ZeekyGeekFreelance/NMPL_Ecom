"use client";
import { useMemo, useState } from "react";
import {
  useCreateChatMutation,
  useGetUserChatsQuery,
} from "@/app/store/apis/ChatApi";
import ChatContainer from "../(chat)";
import MainLayout from "@/app/components/templates/MainLayout";
import { withAuth } from "@/app/components/HOC/WithAuth";

const SupportPage = () => {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const { data: chatsData, isLoading } = useGetUserChatsQuery(undefined);
  const [createChat, { isLoading: isCreatingChat }] = useCreateChatMutation();

  const chats = useMemo(() => chatsData?.chats || [], [chatsData?.chats]);

  const handleCreateChat = async () => {
    try {
      const result = await createChat(undefined).unwrap();
      const newChatId = result.chat.id;
      setActiveChatId(newChatId);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          <aside className="rounded-xl border border-gray-200 bg-white p-4 md:h-[calc(100vh-140px)] md:overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold">Support Conversations</h2>

            {isLoading ? (
              <div className="text-sm text-gray-500">Loading conversations...</div>
            ) : chats.length === 0 ? (
              <div className="text-sm text-gray-500">No conversations yet</div>
            ) : (
              <ul className="space-y-2">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    <button
                      onClick={() => setActiveChatId(chat.id)}
                      className={`w-full rounded-lg p-3 text-left transition ${
                        activeChatId === chat.id
                          ? "bg-blue-100 text-blue-800"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <div className="font-medium">
                        Support Ticket #{chat.id.substring(0, 8)}
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span
                          className={`mr-2 inline-block h-2 w-2 rounded-full ${
                            chat.status === "OPEN" ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {chat.status === "OPEN" ? "Active" : "Resolved"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={handleCreateChat}
              disabled={isCreatingChat}
              className={`mt-4 w-full rounded-lg p-2 text-white transition-colors ${
                isCreatingChat
                  ? "cursor-not-allowed bg-blue-400"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isCreatingChat ? "Creating..." : "New Conversation"}
            </button>
          </aside>

          <section className="min-h-[420px] rounded-xl border border-gray-200 bg-white md:h-[calc(100vh-140px)] md:overflow-hidden">
            {activeChatId ? (
              <ChatContainer chatId={activeChatId} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-gray-500">
                Select a conversation or start a new one.
              </div>
            )}
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default withAuth(SupportPage, { allowedRoles: ["USER"] });
