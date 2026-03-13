import { useState, useEffect } from "react";

export const useChatMessages = (
  chatId: string,
  chat: any,
  sendMessage: any
) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping] = useState(false);

  // Update messages when chat data is fetched
  useEffect(() => {
    if (chat?.messages) {
      setMessages((prev) => {
        // Filter out existing messages => where id is not in prev
        const newMessages = chat.messages.filter(
          (msg: any) => !prev.some((m) => m.id === msg.id)
        );
        return [...prev, ...newMessages].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    }
  }, [chat]);

  const appendMessage = (newMessage: any) => {
    if (!newMessage) return;

    const normalizedMessage = {
      ...newMessage,
      sender: newMessage.sender || { id: newMessage.senderId },
    };

    setMessages((prev) => {
      const exists = prev.some((msg) => msg.id === normalizedMessage.id);
      if (exists) {
        return prev;
      }
      return [...prev, normalizedMessage].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  };

  // Send a message
  const handleSendMessage = async (file?: File, content?: string) => {
    const contentToSend = typeof content === "string" ? content : message;
    if (!contentToSend.trim() && !file) return;

    try {
      const result = await sendMessage({
        chatId,
        content: contentToSend || undefined,
        file,
      }).unwrap();
      if (result) {
        const newMessage = result.message ?? result.data?.message;
        appendMessage(newMessage);
      }
      setMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };
  return {
    messages,
    message,
    setMessage,
    handleSendMessage,
    isTyping,
  };
};
