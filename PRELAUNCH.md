# Pre-launch execution and verification

The repository changes are implemented locally. Production access has not been supplied: both existing `.env` files point to `localhost/fantasy_futsal`. No production reset, price correction, deployment, or production account verification has been performed.

## Price source

`Player.price` (PostgreSQL integer, euros) is the source used by purchase validation, the catalog API and frontend. Seed only assigns prices when creating new players and never recalculates existing team budgets or overwrites current player prices. `INITIAL_BUDGET` lives in `backend/src/config/game.ts`; the Prisma SQL default is kept in sync by migration `20260907120000_launch_budget`. Historical migrations are intentionally unchanged.

The supplied CSV uses Windows-1252 for Spanish characters. All 233 identities (club + number + name) match the seed; 129 original price differences were corrected. See `artifacts/prelaunch/csv-seed-before.json` and `csv-sync.json`. Paola (Alcantarilla #14) is 300 EUR in the source CSV and is preserved pending the owner's clarification.

Run `npm run db:check-csv` to verify and `npm run db:sync-csv` to import price changes from the CSV. Player roles, ages and nationalities are preserved.

## Production procedure

Run from the repository root with `DATABASE_URL` supplied through the existing secure deployment environment. Use the direct PostgreSQL connection when the provider offers one. Do not paste credentials into reports. Pause application writes for the execution window (including older app instances).

1. Deploy the tested application and apply Prisma migrations (`npm run prisma:migrate:deploy -w backend`). Registration must already use 40000 before reopening traffic.
2. Run `npm run db:audit-prices` and retain the JSON output. It checks every database player, missing identities, duplicates, positive integer prices and the price-history chain. Historical deltas are preserved; ambiguous history is reported for review, never silently erased. Identify genuinely test-only sporting statistics/history with the data owner before changing them.
3. Apply unambiguous corrections with `npm run db:audit-prices -- --apply --backup-dir ../backups/production`. It backs up all Player and PlayerPriceChange records before correcting prices in a transaction. Re-run the audit and require no differences/review items. Keep this price backup for any manual recovery.
4. Preview user reset with `npm run db:reset-game`. Default mode changes nothing.
5. Execute `npm run db:reset-game -- --apply --backup-dir ../backups/production`. The script acquires table locks, writes and verifies a durable backup, clears gameplay records, sets every team's budget to 40000 and verifies postconditions inside one Serializable transaction. It processes admin gameplay too while preserving admin accounts and permissions. A backup path is mandatory.
6. Retain the JSON result and the adjacent `.receipt.json`. The backup contains exactly the affected gameplay tables. Account passwords/auth fields are not copied; account preservation is verified with a hash. Store backups outside public assets and Git (the backups directories are ignored).
7. Before traffic resumes, verify an existing account can log in with unchanged credentials and shows 0 players, 40000 EUR, and no point history. Verify a fresh account has the same state, then a legal 10-player team enters the ranking with zero points. Test during the open market window (Tuesday 10:00 to Friday 12:00 Europe/Madrid).
8. Check production network responses, browser console, server and Prisma logs. These production checks remain outstanding.

Reset removes FantasyTeamPlayer, UserGameweekPlayer, UserGameweekSquad, UserGameweekPoints, UserPointAdjustment, GameweekWinner and UserTransfer. It keeps FantasyTeam identity/name, resets `isInitialSquadComplete`, creates missing teams and preserves User, private leagues, memberships, clubs, real player statistics and price history. Historical tour snapshots cannot be recreated using players bought after that tour's deadline.

## Recovery

For a completed reset, run `npm run db:restore-game -- "ABSOLUTE_BACKUP_PATH.json"` to validate recovery, then append `--apply` to restore. The restore verifies the backup checksum, database identity, preserved-data hash and post-reset gameplay hash before writing. It refuses to overwrite subsequent account/statistics/gameplay activity. Recovery is transactional and also makes a backup of the state it replaces. If activity resumed or production changed, use a controlled manual recovery; never bypass the checks casually.

A reset error rolls back all database mutations. A backup/receipt may remain from an attempted transaction; a failed transaction does not need recovery. Both backup and receipt are durably written before commit. Any critical backup or verification failure aborts the reset.

## Verification commands

- `npm run build`
- `npx tsc -p backend/tsconfig.scripts.json`
- `npm run test -w backend`
- `npm run test:prelaunch` (requires migrated/seeded local `fantasy_prelaunch_test`; refuses non-local hosts)
- Start `npm run dev -w frontend`, then `npm run test:prelaunch-ui`

The integration test uses only the dedicated local test database, covering rollback, recovery, preserved accounts/statistics, old/new parity, budgets, 2 goalkeeper and 10-player limits, ranking eligibility, public lineup privacy, retroactive scoring protection, goals correction, role authorization and league deletion isolation. It leaves only test accounts in that dedicated database.

The UI matrix covers UA/ES, light/dark, and 320×568, 360×800, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×720 and 1440×900. UI responses are fixtures; production data is not touched. Reports/screenshots are under `artifacts/prelaunch`.

## Refresh behavior

API responses and fetches use `no-store`; TanStack Query is not persisted. Login/logout clears query data. Navigation and focus refetch stale data; active queries refresh at most every 30 seconds, club goals every 15 seconds. Admin statistics/prices invalidate queries on save, including club rosters and ranking. A refresh or new login requires no manual browser cache clearing.

## Local results

Build and scripts type-check passed. All 12 backend unit tests and the PostgreSQL integration test passed. The responsive UI report contains 432 successful route checks, with no new JavaScript errors or horizontal overflow. An additional browser check confirms goals change 3 → 2 → 0 without reload, hiding the badge at zero. Price repair was exercised against one intentionally corrupted test price and all 233 prices were verified afterward. These are local/test results, not production verification.
