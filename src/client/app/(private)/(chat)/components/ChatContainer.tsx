"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetChatQuery,
  useSendMessageMutation,
} from "@/app/store/apis/ChatApi";
import { useChatMessages } from "../useChatMessages";
import { useGetMeQuery } from "@/app/store/apis/UserApi";

// Components
import ChatLayout from "./ChatLayout";
import MessageList from "./MessageList";
import ChatStatus from "./ChatStatus";
import ChatInput from "./ChatInput";
import ChatSkeletonLoader from "./ChatSkeletonLoader";
import ErrorDisplay from "./ErrorDisplay";

interface ChatContainerProps {
  chatId: string;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ chatId }) => {
  const { data: userData } = useGetMeQuery(undefined);
  const user = userData?.user ?? null;

  const { data, isLoading, error } = useGetChatQuery(chatId);
  const chat = data?.chat;

  const [sendMessage] = useSendMessageMutation();

  const { messages, message, setMessage, handleSendMessage, isTyping } =
    useChatMessages(chatId, chat, sendMessage);

  // Loading state
  if (isLoading) {
    return <ChatSkeletonLoader />;
  }

  // Error state
  if (error) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <ChatLayout chatId={chatId}>
      <div className="flex flex-col h-full">
        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            currentUserId={user?.id || ""}
            isLoading={isLoading}
          />
        </div>

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ChatStatus isTyping={true} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Input */}
        <AnimatePresence>
          {chat?.status === "OPEN" ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <ChatInput
                message={message}
                setMessage={setMessage}
                onSendMessage={handleSendMessage}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gray-50 text-center text-gray-500 border-t border-gray-200"
            >
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-sm">
                  This conversation has been {chat?.status?.toLowerCase()}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ChatLayout>
  );
};

export default ChatContainer;
