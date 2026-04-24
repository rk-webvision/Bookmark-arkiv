# Security Specification for Bookmark Brain

## Data Invariants
1. A user can only access their own profile and bookmarks.
2. Every bookmark must have a valid URL and be associated with the current user's UID.
3. Timestamps must be handled on the server side (`request.time`).
4. IDs must be sanitized and size-limited.

## The Dirty Dozen (Attack Vectors)
1. **Identity Spoofing**: Attempt to write a bookmark with `userId` of another user.
2. **Bulk Read Scrape**: Authenticated user attempts to list all users in the `/users` root.
3. **Ghost Field Mutation**: User attempts to inject an `isVerified: true` field into their profile.
4. **ID Poisoning**: User provides a 1MB string as a bookmark document ID.
5. **PII Leak**: Non-owner attempts to read a user's private document containing their email.
6. **Cross-User Delete**: User attempts to delete another user's bookmark by guessing its ID.
7. **Type Invalidation**: Sending a Boolean instead of a String for the `title` field.
8. **Resource Exhaustion**: Sending a 10,000 element array for `tags`.
9. **Timestamp Forgery**: User attempts to set their own `createdAt` date in the past.
10. **Shadow Path Injection**: Creating a bookmark outside the `/users/{userId}/bookmarks` hierarchy.
11. **Malicious Redirect**: Injecting `javascript:` pseudo-protocols into the `url` field (mitigated by URI string format rules).
12. **State Shortcutting**: Modifying immutable fields like `originalOwnerId`.

## Test Runner Logic
The `firestore.rules.test.ts` (conceptual) will verify that `PERMISSION_DENIED` is returned for all of the above.
