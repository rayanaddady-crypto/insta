export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url: string;
  bio: string;
  theme?: "light" | "dark";
  privacy?: "public" | "private";
  created_at: string;
}

export interface Profile {
  id: number;
  username: string;
  email: string;
  name?: string;
  avatar_url: string;
  bio: string;
  website?: string;
  gender?: string;
  location?: string;
  birthday?: string;
  age?: string | null;
  is_verified?: boolean;
  is_muted?: boolean;
  last_seen?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  is_followed_by?: boolean;
  is_current_user: boolean;
  is_locked?: boolean;
  follow_status?: "pending" | "accepted" | null;
}

export interface Comment {
  id: number;
  text: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    avatar_url: string;
  };
}

export interface FeedPost {
  id: number;
  media_url: string;
  caption: string;
  post_type: "standard" | "reel";
  created_at: string;
  user: {
    id: number;
    username: string;
    avatar_url: string;
    is_verified?: boolean;
  };
  likes_count: number;
  is_liked: boolean;
  is_bookmarked?: boolean;
  comments: Comment[];
}

export interface ReelPost {
  id: number;
  media_url: string;
  caption: string;
  post_type: "reel";
  created_at: string;
  user: {
    id: number;
    username: string;
    avatar_url: string;
    is_following: boolean;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked?: boolean;
  comments: Array<{
    id: number;
    text: string;
    username: string;
    avatar_url: string;
  }>;
}

export interface Message {
  id: number;
  conversation_id?: number;
  sender_id: number;
  receiver_id: number;
  message_text: string;
  is_read?: boolean | number;
  reaction?: string | null;
  created_at: string;
  sender_username?: string;
  sender_avatar?: string;
  reply_to_id?: number | null;
  reply_to_text?: string | null;
  reply_to_username?: string | null;
  is_edited?: boolean | number;
  client_temp_id?: number | string;
}

export interface ChatUser {
  id: number;
  username: string;
  avatar_url: string;
  bio: string;
  is_pinned?: boolean;
  is_online?: boolean;
  is_mutual?: boolean;
  unread_count?: number;
  last_message: {
    id?: number;
    text: string;
    created_at: string;
    is_sender: boolean;
    is_read?: boolean;
  } | null;
}

export interface InstagramNote {
  id: number;
  user_id: number;
  username: string;
  avatar_url: string;
  text: string;
  mood_emoji: string;
  music_track?: string;
  created_at: string;
  is_self?: boolean;
}
