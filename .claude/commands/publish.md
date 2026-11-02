---
description: Check, commit and publish the latest changes to the live CampusOS website
---

Publish my current CampusOS changes to the live website at https://campusos-one-mu.vercel.app/.

1. Run `npm run typecheck`, `npm run lint`, `npx prettier --check .`, `npm test` and `npm run build`. If any fail, stop, explain in plain words what is wrong and do not publish.
2. Run `git status`. Make sure no `.env` file, key, token or other secret is staged. If one is, stop and tell me.
3. Commit everything with a short plain-English message describing the change, then push to `main` (the GitHub tool is at `~/.local/bin/gh` and is already signed in).
4. Wait for Vercel to deploy (the page changes within about a minute), then run `npm run test:live` against the live site.
5. Tell me in simple words whether the live site updated and whether the live checks passed. Do not change any design or remove any feature to make a check pass.
6. Finally run `scripts/backup-to-desktop.sh` so the Desktop backup folder `CampusOS_Backup` matches what was published, and tell me when it last updated.
