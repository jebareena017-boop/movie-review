# CineReview

A cinematic movie review application with separate user and admin portals and SQLite storage.

## Run

1. Install dependencies: `npm install`
2. Start: `npm start`
3. Open `http://localhost:3000`

## Login

- User portal: username `user`, password `123`
- Admin portal: username `admin`, password `123`

## Database

The app creates `movie_reviews.db` in the project root automatically on first start.

## Supabase setup

1. Open your Supabase project SQL Editor.
2. Run the contents of `supabase.sql` to create the `reviews` table and policies.
3. `.env` already contains the configured project URL and publishable key.

The app uses Supabase when `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are set. Otherwise, it falls back to local SQLite.
