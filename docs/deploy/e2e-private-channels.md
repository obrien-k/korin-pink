# End-to-end run: private-community announce delivery

On demand, never a CI gate. It proves ADR-007 against a real Ergo, korin api and
bridge, with a real stellar-api projecting membership and announcing:

- verified members get into `#c-<id>`, and non-members are refused with `473`;
- the channel is `+inst`;
- a private announce lands in `#c-<id>` and **not** in `#announce`, while a
  public one lands in `#announce`;
- a removed member is kicked on the next tick;
- a pre-squatted `#c-<id>` is recovered with ChanServ `PURGE`.

## What you need

- **Docker.**
- **A stellar-api checkout,** with its dependencies installed. Its
  `npm run e2e:korin` script supplies the fixtures.
- **A local Postgres stellar-api can reach** (its dev database container is
  fine), to hold a **throwaway** `stellar_e2e` database. The fixture script
  refuses any other database name.

Everything below uses throwaway secrets only. The korin stack is
`infra/docker-compose.e2e.yml`, on ports 26667 (IRC) and 23000 (api).

## Run it

```bash
# 1. korin: Ergo + api, then the accounts, then the bridge (it SASLs as stellar-bridge)
cd infra
docker compose -f docker-compose.e2e.yml up -d --build ergo api
cd ../packages/irc-bridge
pnpm e2e:private-channels accounts
cd ../../infra
docker compose -f docker-compose.e2e.yml up -d --build irc-bridge
docker compose -f docker-compose.e2e.yml logs irc-bridge | grep "OPER accepted"

# 2. stellar-api: a throwaway database, migrated and seeded
#    (STELLAR_E2E_PSQL_URI = your dev URI with the database name stellar_e2e)
cd /path/to/stellar-api
psql "$DEV_PSQL_URI" -c 'CREATE DATABASE stellar_e2e'
STELLAR_PSQL_URI="$STELLAR_E2E_PSQL_URI" npx prisma migrate deploy
STELLAR_PSQL_URI="$STELLAR_E2E_PSQL_URI" npm run e2e:korin -- seed

# 3. stellar-api, pointed at that database and at korin, on a short tick
STELLAR_PSQL_URI="$STELLAR_E2E_PSQL_URI" STELLAR_HTTP_PORT=18080 \
  KORIN_API_URL=http://127.0.0.1:23000 KORIN_PULL_KEY=smoke-pull-key \
  KORIN_POLL_INTERVAL_MS=5000 npx ts-node -T src/index.ts

# 4. in another terminal, the scenario (exit 0 = every check passed)
cd /path/to/korin-pink/packages/irc-bridge
STELLAR_API_DIR=/path/to/stellar-api STELLAR_E2E_PSQL_URI="$STELLAR_E2E_PSQL_URI" \
  pnpm e2e:private-channels run
```

Each check prints `PASS` or `FAIL`.

## Tear it down

Stop the stellar-api process, then:

```bash
docker compose -f infra/docker-compose.e2e.yml down -v
psql "$DEV_PSQL_URI" -c 'DROP DATABASE stellar_e2e'
```

**Re-run from a clean state.** The scenario mutates its fixtures (it removes bob,
and flips Squat Club to PRIVATE), so a second run against the same state fails
its early checks.

## What it caught

The first run (2026-10-03) found that squat recovery could never complete. The
bridge confirmed `PURGE` with `<code> <reason>`, and Ergo folds everything after
the channel into one final parameter, so the code never matched (fixed in #89).
A fake IRC client can't catch that kind of protocol detail, which is why this
run exists.
