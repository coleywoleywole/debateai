# Fix Blog Formatting & Sitemap

## Summary
- Refined typography in `src/app/blog/[slug]/page.tsx`:
  - Reduced vertical spacing.
  - Adjusted font sizes for blockquotes and headings for better readability.
- Cleaned up conflicting styles in `globals.css`.
- Fixed `lib/blog.ts` to filter out future-dated posts from `getAllPosts`.
- Fixed `sitemap.ts`:
  - Uses `www.debateai.org` as default base URL.
  - Removed duplicate topic history entry.
  - Added `/explore`.
- Fixed apex domain redirect regression in `middleware.ts`.
- Added missing hero image for `gpt4-vs-claude3-debate.md`.

## Testing
- Verified build locally (82 pages generated).
- Checked sitemap generation.
- Visual inspection of blog posts (simulated).
