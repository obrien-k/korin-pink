---
title: "IRCScore"
sidebar:
  label: "IRCScore"
---
# IRCScore

IRCScore is a dimension of the **Community Reputation Score (CRS)** in Stellar. It measures how active and consistent you are on korin.pink IRC.

---

## Formula

```
IRCScore = activity × consistency × channelQuality   (cap = 6, weight = 1.0)

activity       = log1p(messageCount)   / log1p(50)
consistency    = presenceSeconds / windowDurationSeconds
channelQuality = log1p(channelCount)   / log1p(5)
```

All three factors are in `[0, 1]`. Their product gives a natural score between 0 and 1 before scaling to the cap of 6.

| Factor           | What it measures                                     | Saturates at |
| ---------------- | ---------------------------------------------------- | ------------ |
| `activity`       | Messages sent in the flush window (log-scaled)       | ~50 msgs     |
| `consistency`    | Fraction of the window you were online               | 100% uptime  |
| `channelQuality` | Number of unique channels you were active in (log)   | ~5 channels  |

**Log-scaling** on messages and channels means the marginal score gain from a 500-message flood is nearly zero — quality of presence matters more than volume.

---

## How it's computed

The irc-bridge daemon on korin.pink tracks per-nick: `presenceMs`, `messageCount`, and `channels`. It flushes this data to the korin API every 60 seconds (`FLUSH_INTERVAL_MS`).

Stellar polls `GET /irc/metrics` every 5 minutes and caches the result. When your CRS is read (on profile load, leaderboard, etc.), `getIrcScore(nick)` is called against the cached metrics — no extra DB query.

The score reflects the **most recent completed flush window** at time of read. It's stale by at most one poll interval (5 minutes by default).

---

## How to earn IRCScore

1. **Register a nick** on `irc.korin.pink` ([connecting guide](/wiki/irc/connecting))
2. **Link it to your Stellar account** via `PUT /api/users/:id/irc-nick`
3. **Show up.** Consistent presence matters more than high message volume.

Absence of an IRC nick earns a score of 0 — IRC participation is optional and its absence doesn't penalise other CRS dimensions.

---

## Nick linking

```
PUT /api/users/:id/irc-nick
Content-Type: application/json
{ "ircNick": "your_nick" }
```

- The nick must match your registered Ergo username exactly (case-insensitive on Ergo's side, stored as-entered on Stellar's side).
- Only one Stellar account can claim a given nick. Conflicts return `409 Conflict`.
- To unlink, send `{ "ircNick": null }`.
- Admins can update any user's nick; regular users can only update their own.
