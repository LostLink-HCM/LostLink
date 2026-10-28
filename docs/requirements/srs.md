# Software Requirements Specification (SRS) - LostLink

**English** | [Tiếng Việt](srs.vi.md)

## 1. Introduction

LostLink is a web platform that helps people in Ho Chi Minh City find and return lost items: it automatically suggests matches between Lost and Found posts, verifies ownership before a handover and keeps both sides' contact details private. This document lists the functional and non-functional requirements and is the shared reference for design, implementation, testing and code review.

### 1.1. User roles

Each higher role inherits the permissions of the roles below it. Post review (M03) and report handling (M04) are for Moderators only.

| Role          | Description                                     | Requirement groups |
| ------------- | ----------------------------------------------- | ------------------ |
| **Guest**     | Visitor who is not signed in                    | G01-G05            |
| **User**      | Signed-in user with a verified email            | G01, G02, U01-U09  |
| **Moderator** | Moderates content and handles stalled handovers | U01-U09, M01-M07   |
| **Admin**     | System administrator                            | U01-U09, A01-A09   |

### 1.2. Glossary

| Term                  | Meaning                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Lost / Found post     | The two post types. The matcher always pairs one Lost post with one Found post.                 |
| Match suggestion      | A pair of opposite posts scored by the system and sent to both sides, with a score and reasons. |
| Verification question | A multiple-choice question the finder sets on a Found post. It can be answered only once.       |
| Contact request       | A single intro message to the post owner. A conversation opens only after it is accepted.       |
| Escalation            | A stalled handover case passed to a Moderator.                                                  |
| Watch area            | An area (center and radius) a user follows to be notified about new posts.                      |
| Reputation            | Points earned from successful handovers and reviews, used for the leaderboard and badges.       |

## 2. Functional requirements

### 2.1. Guest

#### G01 - Browse and search posts

- **Latest posts:** show only posts approved by a Moderator and not hidden. Each card shows the cover image, Lost/Found label, author, category, title, post time, short description, place and area, time of loss/find, and like, comment and view counts. Newest first by default. Clicking a card opens the post detail.
- **Filter and search:** filter by post type, category, area and time range (default: all categories, last 7 days). Keyword search over item name, description, area and place.
- **Hot posts:** sorted by `hotScore = views + likes × 20`, with the same filters as the home page.
- **Post detail:** images, post type, category, title, description, attributes, post time, time of loss/find, place, author with reputation and number of returns, like/comment/view counts and the comment list. Each open counts as one view.
- When a Guest clicks Like, Save, Follow, Comment, "This is mine", "I have this item" or Report, the system goes to Sign in and returns to the same page afterwards.

#### G02 - View leaderboard and community stats

- **Leaderboard:** the quarterly "Kind people" board, ranked by reputation, with rank, username, number of returns and points. Guests see it only in the home page's right column. Clicking a person asks them to sign in.
- **Community stats:** anonymous totals: posts created, items returned, match success rate and average time to return.

#### G03 - Register

- **Username:** 3-30 characters, only unaccented letters, digits, dots and underscores, unique.
- **Email:** valid format, lowercased automatically. If the email is already verified on another account, say it is already registered.
- **Password:** 8-72 ASCII characters, no accents or spaces, with at least 1 lowercase letter, 1 uppercase letter, 1 digit and 1 special character.
- **Email opt-in:** optional, checked by default. **Accept terms:** required.
- If the input is valid, create an unverified account and email a 6-digit code.
- **Email verification:** 6-digit OTP, valid for 10 minutes, at most 5 wrong attempts (after that a new code is required). Resending a code invalidates the old one. A successful verification signs the user in.

#### G04 - Sign in

- **Email and password:** wrong credentials show only the generic "Email or password is incorrect". Unverified accounts go to the verification screen (enter the code or resend it). Locked accounts cannot sign in.
- **Google:** authenticate with a Google ID token. Accounts already linked to Google sign in directly. Otherwise create a new account: the username comes from the part of the email before @ (with a number appended if taken), and the email counts as verified.

#### G05 - Recover password

- **Forgot password:** the user enters an email and receives a reset link valid for 10 minutes.
- **Reset password:** the link must be valid and unexpired, and the new password follows the G03 rules. A successful reset signs the account out on every device.

### 2.2. User

Users can also use the Guest features G01 and G02.

#### U01 - Sign out

End the current session. Old tokens are revoked and cannot be reused.

#### U02 - Manage profile

- **View profile:** username, avatar, bio, badges, reputation, own posts, thanks and reviews from others.
- **Update profile:** change avatar, bio and usual areas.

#### U03 - Manage account

- **Change password:** enter the current and new password. Old sessions are revoked afterwards.
- **Change email:** the new email must be unused and verified with an OTP before it replaces the old one.
- **Delete account:** requires confirmation. All posts and messages are deleted and cannot be restored 3 days after confirming.

#### U04 - Community connections

- **View another user's profile:** name, badges, bio, reputation, posts (filter All / Lost / Found) and the "What others say" section.
- **Follow / unfollow:** get notified when that user posts.
- **Block / unblock:** hide the blocked user's posts and lock conversations with them. Unblocking shows the posts again and unlocks conversations.

#### U05 - Manage own posts

- **Create a Lost / Found post:**
  - Classification: post type, category, attributes.
  - Content: required title (max 120 characters), description up to 1,000 characters, optional images (JPG, PNG or WEBP, up to 9 images, max 5 MB each, the first one is the cover).
  - Time: date of loss/find is required and cannot be in the future. Approximate times ("This morning", "Last night") and a time-of-day range are allowed.
  - Location: GPS, drag a pin, type an address or pick a street segment, plus a required district.
  - Multiple-choice verification question: Found posts only, optional.
  - Review before posting: show all content step by step, with the option to go back and edit any step.
  - New posts start as Pending. Restricted accounts cannot post.
- **Save draft:** keep unfinished content. Reopening the compose form shows the draft and resumes from the unfinished step.
- **Edit post:** own posts only, and not when Contacted, Returned or Closed. An edited post returns to Pending and is hidden until approved again.
- **Delete post:** own posts only. Warn first if the post has an active match or conversation.
- **Close / mark as Returned:** close the post when the item was not found or is no longer needed (Closed), or mark it Returned. Every state change is recorded in the history.

#### U06 - Interact with posts

- **Comment:** up to 500 characters, edit/delete own comments only, at least 15 seconds between comments.
- **Like / unlike:** one like per user per post. Likes feed the hot score.
- **Save:** keep the post in the Saved list.
- **Follow post:** get notified when the post changes state or gets a new comment.
- **Report:**
  - Report a post (from Post detail) for: asking for money, spam, fake post, other. Report a user (from a conversation) for: asking for money, spam, harassment, false claim, other.
  - "Other" requires a description. Description up to 1,000 characters, optional screenshots (up to 3 JPG, PNG or WEBP images, max 5 MB each).
  - Each user can report a post or a user only once. Reporters stay anonymous, receive the outcome and are rate limited.

#### U07 - Matching and verification

- **Match suggestions:** a "Could this be yours?" list. Each suggestion shows the opposite post's card, a match score and reasons ("~800 m away", "1 day apart"). The owner clicks "Yes, it's mine" to go to verification or send a contact request. The finder clicks "I have this item" to send a contact request. "Not mine" marks the suggestion as rejected.
- **Claim from a post:** Found posts have a "This is mine" button, Lost posts have an "I have this item" button. Clicking it starts the verification/contact flow, with rate limiting.
- **Answer the verification question:** applies when a Found post has a question, and it can be answered only once. A correct answer opens a conversation and moves the post to Contacted. A wrong answer fails verification and cannot be retried for that post.

#### U08 - Contact and handover

- **Send a contact request:** applies when a Found post has no verification question, or when a finder clicks "I have this item" on a Lost post. The sender gets one intro message and can continue only after it is accepted.
- **Review contact requests:** the post owner reads the intro and either Accepts (opens a conversation, the post moves to Contacted) or Declines.
- **Messaging:** available only after a correct verification or an accepted contact request. The conversation list is searchable, each conversation is tied to its post, and users can send text and images. Users can also open a conversation with a Moderator for support (complaints, stalled handovers, incidents…).
- **Confirm handover:** when both sides confirm, the post moves to Returned and the returner gains reputation. If nobody confirms within 30 days, the system asks a Moderator to confirm on their behalf.
- **Close and reopen a conversation:**
  - Either side can close a conversation when the item does not match. If the post has no other open conversation it goes back to Searching, otherwise only that conversation closes.
  - A conversation you closed moves to "Closed": new messages from the other side are still stored, but send no notification and do not count as unread.
  - The other side sees a "not a match" note and can still message, but cannot confirm the handover.
  - The closer can reopen it at any time. If the post is still Searching it moves back to Contacted.
- **Review and thank:** shown once the post is Returned. Pick a 5-level rating, the other person's strengths and write a thank-you note. Reviews affect reputation.

#### U09 - Notifications

- **Notification settings:** toggle email, toggle push notifications, choose which notification types to receive. With email off, the 12-hour reminder email is not sent.
- **Notification center:** notifications about matches, comments, post approval/rejection, report outcomes and new posts in watch areas. Filter by type, mark as read. Important notifications are also emailed when enabled.
- **Watch areas:** pick a center on the map and a radius, add/remove/toggle each area. New posts inside an area trigger a notification.

### 2.3. Moderator

Every table list below is paginated at 10 rows per page.

#### M01 - View dashboard

Post counts per state (Pending, Rejected, Searching, Contacted, Returned, Closed), posts awaiting review, reported posts/accounts, and cases awaiting escalation.

#### M02 - Manage all posts

- **List:** ID, post info (title, category), type, time and location, stats (views, comments, matched posts), state.
- **Detail:** ID, title, author, type, category, post date and time, location, state, description, images, and matched posts sorted by match score descending.
- Update a post's state. Hide a post, with a required reason.
- Search. Filter by state, category, type, area and time range. Export the list.

#### M03 - Review posts

- **Pending list:** ID, title, type, author (with reputation), category and location.
- **Detail:** title, ID, author, reputation, type, category, post time, location, description, images.
- Approve (with a confirmation dialog). Reject, with a required reason.
- Search. Filter by category, type, area and time range. Export the list.

#### M04 - Manage report queue

- **List:** time (ID, date and time reported), report type (account/post), target, reason and severity (severe/warning).
- **Detail:** ID, time, target, type, reason, severity, and the reporter's description.
- Actions: send a warning, lock the account or hide the post depending on reason and severity, or dismiss the report if it is unfounded.
- Search. Filter by report type, severity and time range. Export the list.

#### M05 - Escalation

- **List:** matched pair, both parties, waiting time, status.
- **Case detail:** finder and owner info, case group, last activity time, reminder email history.
- Send reminder emails to both sides (subject and body have suggested text, plus a reason).
- Confirm the handover on their behalf, mark it as not a match, tag as verified, or hide a suspicious post. Every action requires a reason or evidence.
- Search by case ID, item or author. Filter by case group and handled/unhandled. View the action log.

#### M06 - Messaging

Message Users/Admins, search by name, filter by User/Admin, mark as unread, flag as priority.

#### M07 - Manage notifications

List notifications, search by content, filter by type/time range/unread/pinned, mark as read, pin important notifications (shown first), delete notifications.

### 2.4. Admin

Every table list below is paginated at 10 rows per page.

#### A01 - View dashboard

- Post count, match success rate, new reports, account locks.
- Chart comparing lost and found posts over a time range.
- Top 5 areas by post count (descending). Selecting an area shows its metrics and chart.
- Filter by time range and area.

#### A02 - Manage users

- **List:** account, role, status, join date.
- **Detail:** account ID, username, email, join date, last update, badges.
- Lock an account (required reason, the user is notified). Grant/revoke the Moderator role (required reason).
- Search. Filter by role (User/Moderator/Admin) and status (active/restricted/locked). Sort by newest, highest reputation, lowest reputation, name A-Z. Export the list.

#### A03 - Manage categories

- View, search, add, edit and delete categories. A category has a name, aliases, matching radius, relation group, attributes and suggested verification questions.
- Add, edit and delete attributes: name, strength (strong/medium/weak), aliases.
- Add and edit suggested verification questions.
- Category names and aliases must be unique.

#### A04 - Manage all posts

Same as M02.

#### A05 - Manage system configuration

- View the current configuration and its last update time.
- **Time thresholds:** inactivity threshold (days), contact reminder delay after both sides confirm a match, handover deadline.
- **Matching weights:** location, time, category, description, image. Each weight is an integer from 0-100%, and they must sum to 100%.
- **Matching results:** maximum number of suggestions.
- **Report threshold:** number of days.
- Save or discard changes.

#### A06 - Escalation

Same as M05.

#### A07 - View audit log

List with time, actor, action, target and details. Search, filter by role/target/time range, export the list.

#### A08 - Messaging

Message Moderators, search by Moderator name or content, mark as unread, flag as priority.

#### A09 - Manage notifications

Same as M07.

## 3. Non-functional requirements

| ID   | Requirement                | Description                                                                                                                                                                                                                                                                   |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NF01 | Hide contact details       | Email and contact details are never public. Intro messages cannot contain phone numbers or addresses. Reported users never learn who reported them.                                                                                                                           |
| NF02 | Password and code storage  | Passwords are hashed with bcrypt. OTPs, password reset tokens and verification answers are stored only as hashes.                                                                                                                                                             |
| NF03 | Session management         | JWT: 15-minute access token, 7-day refresh token, refreshed automatically. Signing out, changing or resetting the password revokes every old token.                                                                                                                           |
| NF04 | Authorization              | Permissions are checked on the server by role and ownership. Guests can read only public data.                                                                                                                                                                                |
| NF05 | Abuse and fraud prevention | Auth API 20 requests/15 minutes/IP, general API 300 requests/15 minutes. At most 5 wrong OTP attempts. Verification questions are answered once.                                                                                                                              |
| NF07 | Backup and recovery        | Daily automatic database backup at 04:00, kept for 6 months. Admins can restore data after an incident.                                                                                                                                                                       |
| NF08 | Error handling             | Errors share one response format. 5xx errors do not leak internal details. Failures in external services (email) do not break the main action.                                                                                                                                |
| NF09 | Integrity and availability | Every post state change is recorded in its history. At least 99% uptime per month.                                                                                                                                                                                            |
| NF10 | Response time              | Page load, filtering and search within 2 seconds. Save actions within 3 seconds (excluding image upload). Match suggestions within 1 minute of approval, if matching posts exist.                                                                                             |
| NF11 | Load capacity              | At least 100 concurrent users while still meeting NF10. Lists are paginated and use geospatial indexes.                                                                                                                                                                       |
| NF12 | Usability                  | Vietnamese UI with clear error messages. Desktop first, responsive on mobile.                                                                                                                                                                                                 |
| NF13 | External integrations      | Google Identity, Cloudinary (up to 9 images per post, max 5 MB each), an email delivery service, and a map and geocoding service.                                                                                                                                             |
| NF14 | Configurable parameters    | Radius, time window, algorithm weights, report thresholds and reminder delays are editable from the Admin screens without code changes.                                                                                                                                       |
| NF15 | System logs                | Server error logs. Read-only audit log of Moderator/Admin actions (who, what, when). Logs never contain passwords, OTPs or tokens.                                                                                                                                            |
| NF16 | Personal data and licenses | Comply with the Personal Data Protection Law No. 91/2025/QH15 and Decree 356/2025/ND-CP: send email only with consent, let users delete their data. Use only open-source libraries whose licenses allow free use. Follow the terms of Google, Cloudinary and the map service. |
