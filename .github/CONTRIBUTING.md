# Contributing to LostLink

All conventions for tooling, formatting, naming, backend and frontend structure, configuration and
Git live in the [coding convention](../docs/coding-convention.md). Read it before opening a pull request.

## Workflow

1. Branch off `main` using `<type>/<short-description>`, e.g. `feat/post-draft`, `fix/login-redirect`.
2. Write commit messages in English following Conventional Commits: `feat(posts): edit and delete own posts`.
3. Run the same checks as CI before pushing:

   ```bash
   npm run ci
   ```

4. Open a pull request against `main`, fill in the PR template and get at least one approving review.
5. Merge only when CI is green: format, lint (no warnings allowed), tests, build, audit and secret scan.

## Do not

- Commit directly to `main`.
- Commit `.env` files or any keys, passwords or tokens.
- Disable lint rules or skip tests to make CI pass.
