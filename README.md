# Connect & Share

Build a social networking web app called "FlowText" — a Facebook-style

platform for connecting, sharing, and communicating with others.

CORE CONCEPT

FlowText lets users create a profile, build a network of friends/connections,

share posts (text, images, video), and communicate through a central news

feed, groups, and private messaging.

USER ACCOUNTS & PROFILES

- Email/password signup and login, plus "remember me" session persistence

- User profile with: profile photo, cover photo, display name, bio, location,

  work/education fields, join date

- Editable profile settings page

- Public profile view (what others see) vs. own profile edit view

SOCIAL GRAPH

- Send / accept / decline friend requests

- Follow/unfollow option separate from friending (for public figures/pages)

- Friends list page with search and mutual-friends indicator

- Suggested connections based on mutual friends

NEWS FEED

- Chronological or algorithmic feed of posts from friends and followed pages

- Compose box supporting text, image upload, and video upload

- Like/react (multiple reaction types: like, love, laugh, etc.), comment, and

  share on each post

- Nested comment threads with their own likes/replies

- Infinite scroll / pagination on the feed

GROUPS & PAGES

- Create and join groups (public or private) around a topic/interest

- Group feed separate from the main feed

- Simple "Page" entity for businesses/brands that users can follow

MESSAGING

- Real-time or near-real-time 1:1 direct messaging

- Group chat threads

- Unread message indicators and a message inbox list

NOTIFICATIONS

- Notification center for: friend requests, likes, comments, mentions, and

  new messages

- Unread notification badge/count

SEARCH

- Global search across people, posts, groups, and pages

MEDIA HANDLING

- Image and video upload with basic compression/resizing

- Media gallery per user profile (photos they've posted)

NON-FUNCTIONAL REQUIREMENTS

- Responsive design — usable on both desktop and mobile browsers

- Clean, modern UI with a light theme (Facebook-style blue accent is fine,

  or propose your own distinct palette for FlowText)

- Reasonable loading states and empty states for every list/feed

- Basic privacy controls: post visibility set to public / friends-only / only me

DATA MODEL (suggested entities)

- User (id, name, email, password_hash, bio, avatar_url, cover_url, created_at)

- Friendship (user_id, friend_id, status: pending/accepted)

- Post (id, author_id, content, media_urls, visibility, created_at)

- Comment (id, post_id, author_id, content, parent_comment_id, created_at)

- Reaction (id, post_id or comment_id, user_id, type)

- Group (id, name, description, privacy, created_by)

- GroupMembership (group_id, user_id, role)

- Message (id, sender_id, thread_id, content, media_url, created_at)

- MessageThread (id, participant_ids, is_group)

- Notification (id, user_id, type, actor_id, target_id, read_at)

Start by scaffolding authentication and the user profile, then the news

feed with posting/liking/commenting, then friending, then messaging and

groups last. Keep FlowText's branding distinct — don't reuse Facebook's

logo, name, or blue-and-white visual identity; propose FlowText's own

color palette and wordmark treatment.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flowtext.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/edfc0a99-a53b-46b6-b532-e7d88ec55b3a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
