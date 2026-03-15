import { useEffect, useRef } from 'react';

interface UseChatNotificationsProps {
  messages: any[];
  currentUserId: string;
  isActive: boolean;
}

export const useChatNotifications = ({ 
  messages, 
  currentUserId, 
  isActive 
}: UseChatNotificationsProps) => {
  const lastMessageRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notification sound
    if (!audioRef.current) {
      audioRef.current = new Audio('/notification.mp3'); // You'll need to add this audio file
      audioRef.current.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // Check if this is a new message from another user
    if (
      lastMessageRef.current?.id !== lastMessage.id &&
      lastMessage.sender?.id !== currentUserId &&
      !isActive
    ) {
      // Show notification
      showNotification(lastMessage);
      
      // Play sound
      if (audioRef.current) {
        audioRef.current.play().catch(() => {
          // Ignore audio play errors
        });
      }
    }

    lastMessageRef.current = lastMessage;
  }, [messages, currentUserId, isActive]);

  const showNotification = (message: any) => {
    // Check if browser supports notifications
    if (!('Notification' in window)) return;

    // Request permission if not granted
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show notification if permission is granted
    if (Notification.permission === 'granted') {
      // Sanitize user input to prevent XSS in browser notifications
      const sanitizedName = String(message.sender?.name || 'Customer').replace(/[<>"'&]/g, '');
      const sanitizedContent = String(message.content || 'Sent a message').replace(/[<>"'&]/g, '').substring(0, 100);
      
      new Notification('New Message', {
        body: `${sanitizedName}: ${sanitizedContent}`,
        icon: '/favicon.ico',
        tag: 'chat-message',
        requireInteraction: false,
      });
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  return {
    requestNotificationPermission,
  };
};
