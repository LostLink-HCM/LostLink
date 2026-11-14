# Coding Convention – LostLink

## 1. Required tools

| Tool         | Scope                    | Config                           | Command                                   | CI                                        |
| ------------ | ------------------------ | -------------------------------- | ----------------------------------------- | ----------------------------------------- |
| Prettier     | Whole repo (JS, JSX, MD) | `.prettierrc`, `.prettierignore` | `npm run format` / `npm run format:check` | Job `Format (prettier)`                   |
| EditorConfig | Whole repo               | `.editorconfig`                  | Applied by the editor                     | –                                         |
| oxlint       | `backend/`, `frontend/`  | `.oxlintrc.json` in each folder  | `npm run lint` in each folder             | Job `Backend (lint)`, `Frontend (lint …)` |
| gitleaks     | Git history              | Default                          | –                                         | Job `Secret scan (gitleaks)`              |

Run every CI check locally with `npm run ci` (at the repo root).

**Lint target: 0 errors, 0 warnings.** The `lint` script runs `oxlint --deny-warnings`, so a single
warning fails the command and CI blocks the PR. Backend-specific rules (`backend/.oxlintrc.json`):

- `no-unused-vars`: unused variables or parameters are errors; prefix the name with `_` to keep one.
- `eqeqeq`: always use `===`/`!==`; only `== null` is allowed, to check `null` and `undefined` at once.
- `no-var`, `prefer-const`: no `var`; declare variables that are never reassigned with `const`.

Do not disable a rule with an `oxlint-disable` comment without stating the reason.

## 2. Formatting

Decided by Prettier and EditorConfig, so **formatting is not discussed in review**:

- 2-space indentation, LF line endings, UTF-8, final newline.
- No semicolons; single quotes `'...'`.
- Maximum line length of 100 characters.
- ES5 trailing commas (multi-line arrays and objects).
- Arrow functions always wrap parameters in parentheses: `(x) => x * 2`.

## 3. Naming

### 3.1. Identifiers

| Kind                                     | Style              | Example                              |
| ---------------------------------------- | ------------------ | ------------------------------------ |
| Variables, functions, parameters         | camelCase          | `listPosts`, `accessToken`           |
| React components, models, classes        | PascalCase         | `PostCard`, `PostLike`, `ApiError`   |
| Module-level constants                   | UPPER_SNAKE_CASE   | `COMMENT_MAX`, `HCM_CITY_ID`         |
| React hooks                              | `use` + PascalCase | `usePostFeed`, `useInfiniteScroll`   |
| Booleans                                 | `is/has/can…`      | `isForm`, `hasMore`                  |
| Required but unused parameters/variables | `_` prefix         | `errorHandler(err, req, res, _next)` |

Identifiers (variables, functions, files) are written in **English**.

### 3.2. File names

**Backend** (`backend/src/`):

| Folder                   | Convention                    | Example                               |
| ------------------------ | ----------------------------- | ------------------------------------- |
| `models/`                | PascalCase, singular noun     | `Post.js`, `PostLike.js`              |
| `controllers/`           | `<resource>Controller.js`     | `postController.js`                   |
| `services/`              | `<resource>Service.js`        | `postService.js`, `emailService.js`   |
| `routes/`                | `<resource>Routes.js`         | `postRoutes.js`                       |
| `middleware/`            | camelCase                     | `authMiddleware.js`, `rateLimiter.js` |
| `middleware/validation/` | `<resource>Validation.js`     | `postValidation.js`                   |
| `utils/`                 | camelCase (class: PascalCase) | `asyncHandler.js`, `ApiError.js`      |
| `tests/`                 | kebab-case + `.test.js`       | `create-post.test.js`                 |

**Frontend** (`frontend/src/`):

| Folder          | Convention                     | Example                            |
| --------------- | ------------------------------ | ---------------------------------- |
| `pages/`        | PascalCase + `Page.jsx` suffix | `HomePage.jsx`, `EditPostPage.jsx` |
| `components/`   | PascalCase `.jsx`              | `PostCard.jsx`, `FeedFilters.jsx`  |
| `hooks/`        | `useXxx.js`                    | `usePostFeed.js`                   |
| `api/`          | camelCase, plural, by resource | `posts.js`, `notifications.js`     |
| `lib/`, `data/` | camelCase                      | `passwordRules.js`, `homeFeed.js`  |
| `tests/unit/`   | camelCase + `.test.js`         | `passwordRules.test.js`            |
| `tests/e2e/`    | kebab-case + `.spec.js`        | `compose-post.spec.js`             |

Files containing JSX use `.jsx`; plain logic files use `.js`.

## 4. Backend

### 4.1. Layers

A request passes through the layers in order, and **each layer does only its own job**:

```
routes → middleware (auth, rate limit, validation) → controller → service → model
```

| Layer          | Does                                                        | Does not                                 |
| -------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `routes/`      | Declares paths, wires middleware and controllers            | Contain logic                            |
| `middleware/`  | Authentication, authorization, rate limiting, validation    | Run business queries                     |
| `controllers/` | Reads input from `req`, calls a service, sends the response | `require` models, contain business logic |
| `services/`    | Business logic, model queries, throws `ApiError`            | Touch `req`/`res`                        |
| `models/`      | Mongoose schemas, indexes, data constraints                 | Call services                            |

### 4.2. Modules

- The backend uses **CommonJS** (`require` / `module.exports`). Do not mix in `import`/`export`.
- `require` order: external packages first, a blank line, then internal modules.
- Each file exports an object of named functions: `module.exports = { listPosts, getPost }`.

### 4.3. Input validation

- Use `express-validator`. Rule sets live in `middleware/validation/<resource>Validation.js` and their
  names end with `Rules` (`createPostRules`, `commentBodyRules`).
- Always follow a rule set with the `validate` middleware, which returns 422 with per-field `details`.
- Length and value limits are named constants (`COMMENT_MAX`), never literal numbers inside rules.

### 4.4. Error handling and response format

- Wrap controllers in `asyncHandler`; **do not** write `try/catch` just to forward errors.
- Throw business errors with `ApiError` (`ApiError.notFound(...)`, `ApiError.forbidden(msg, code)`…).
  Services never call `res.status(4xx).json(...)` themselves.
- All errors end up in `errorMiddleware`: only 5xx errors are logged and sent to Sentry; in production
  the response never includes `stack` or the name of a duplicated field.
- Success response: `{ success: true, data }`.
- Error response: `{ success: false, message, code?, details? }`.

## 5. Frontend

- The frontend uses **ES modules** (`import`/`export`).
- Components are functions, `export default function ComponentName()`, one main component per file.
- Follow the Rules of Hooks (oxlint enforces it as an `error`). Logic shared across pages goes into a
  hook in `hooks/`.
- **Call the API only through `src/api/*`**, which uses the shared client `src/lib/api.js` (attaches the
  token, refreshes it, normalizes errors into `ApiError`). Never call `fetch` directly in a component.
- Show field errors under their inputs using `error.fieldErrors`.
- Folders are split by user role: `user/`, `moderator/`, `admin/`; shared parts go in `common/` or
  `backoffice/`.
- Styling uses Tailwind CSS; combine conditional classes with the `cx` helper.

## 6. Configuration and secrets

- In the backend, environment variables (`.env`) are read only in `src/config/env.js`; other files get
  values from the `env` object it exports instead of reading `process.env` directly.
- The frontend only uses `VITE_`-prefixed variables through `import.meta.env`.
- Never commit `.env`. When adding a variable, update `.env.example` and the README.
- Never hard-code API keys, passwords or tokens in code or tests.

## 7. Git and pull requests

- **Branches:** `<type>/<short-description>`, e.g. `feat/post-draft`, `fix/login-redirect`,
  `ci/e2e-cache`. Never commit directly to `main`.
- **Commits:** follow [Conventional Commits](https://www.conventionalcommits.org/), in English, imperative
  mood: `<type>(<scope>): <description>`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`,
  `chore`, `ci`.

  ```
  feat(posts): edit, delete and close own posts
  test(e2e): make home feed scroll test independent of seed size
  ```

- **Pull requests:** fill in `.github/pull_request_template.md` and get at least one approving review.
