-- ====================================================================
-- INSTACLONE POSTGRESQL DATABASE SCHEMA (DDL)
-- Production-Ready Database Schema with Foreign Keys, Cascades, and Indexes
-- ====================================================================

-- Enable UUID extension if we want to use UUIDs for IDs (optional, using serial here for standard relational consistency)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define post_type custom enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN
        CREATE TYPE post_type AS ENUM ('standard', 'reel');
    END IF;
END $$;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    bio VARCHAR(150) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. POSTS TABLE
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    caption TEXT,
    post_type post_type NOT NULL DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. LIKES TABLE (Composite Primary Key to enforce unique likes per user per post)
CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

-- 4. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. FOLLOWS TABLE (Self-referencing relationship for follower-following graph)
CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT cannot_follow_self CHECK (follower_id <> following_id)
);

-- 6. MESSAGES TABLE (Real-time Direct Messages)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cannot_message_self CHECK (sender_id <> receiver_id)
);

-- ====================================================================
-- PERFORMANCE INDEXES (Essential for Query Optimization)
-- ====================================================================

-- Speed up user lookup by username/email
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Speed up feed generation (posts from users the follower is following, ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);

-- Speed up comments retrieval for a post
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- Speed up follower/following lists
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- Speed up direct message queries (conversations between two users, ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender ON messages(receiver_id, sender_id, created_at ASC);
