---
title: "How Stellar Works"
description: "Contributions, link health, and related terms"
---

**Stellar** is an invite-only community content tracker, used by [SITE_NAME] to facilitate the discovery and download of music files between its members. It differs from fully open filesharing services, which typically place no accountability on the people accessing hosted content. In an unaccountable environment, a small number of contributors end up hosting content for a large number of consumers, with nothing to ensure those contributors are rewarded or sustained. Over time this leads to degraded availability and an erosion of the community that produces the content in the first place.

Stellar solves this by organizing members into **Communities** — curated, invite-only spaces where every piece of shared content (called a **Contribution**) is a hosted download link contributed by a member. The platform tracks who uploads, who downloads, and how much, creating a system of mutual accountability that incentivizes healthy, long-term participation. A member's standing is captured not only by raw statistics but by the **Community Reputation Score (CRS)**, a composite reputation model that rewards consistent, high-quality contribution across social, content, and longevity dimensions.

## What is a Contribution?

A **Contribution** is Stellar's unit of shared content within a Community — concretely, a hosted Download URL paired with structured release metadata. When a member contributes a music release, they supply the download link alongside details such as the release type, edition, record label, catalogue number, format, and per-file rip metadata (bitrate, whether a log and cue sheet are present, etc.). This structured data is stored in a hierarchy:

The **Release** holds the identity of the work (type, year, artist credits).
An **Edition** holds pressing-specific details (label, catalogue number, media, remaster/reissue flags).
A **Release File** holds per-file rip metadata for a music Contribution (bitrate, log, cue).
Together these form the **Contribution Spine** — the type-agnostic record every Contribution shares — with music-specific detail in satellite models rather than cluttering the core record. Future content types (eLearning videos, film) will attach their own analogous satellites.

## Link Health

Because a Contribution is a hosted link rather than a file stored on the server, [SITE_NAME] continuously monitors whether those links remain reachable. This monitoring is called **Link Health**. The platform performs regular HEAD-request checks on every contribution link and assigns each one a status:

**PASS** — the link is currently reachable and the contribution is **effectively available**. **WARN** — the link has been reported or has failed a recent check but has not yet been confirmed dead. Contributions in WARN still count toward a contributor's ratio relief. **FAIL** — the link is confirmed unreachable. The contribution is no longer effectively available and is removed from the contributor's ratio relief pool until the link is restored.

If a contribution remains in WARN for more than 72 hours without being resolved, the platform automatically promotes it to FAIL. Staff are notified at three accumulated reports on a single link, allowing them to intervene before a link is auto-failed.

## The Ratio

Because Stellar tracks both what members upload (contribute) and what they download (consume), it can enforce a **ratio** — a minimum relationship between how much a member has received from the community and how much they have given back. The ratio is not simply a lifetime byte counter; it reflects **ongoing availability**.

**Consumed**: the total bytes a member has downloaded from the platform. Permanent — it is never clawed back.
**Contributed**: the bytes others have downloaded through a member's contribution links. Also permanent — earned at the moment of each download.
**Coverage**: the ratio-relief term. Calculated from a member's staff-approved, 72-hour-old contribution bytes whose link status is currently not FAIL. Only contributions that are actually live lower your required ratio. When a contribution's link dies, it leaves the coverage pool and your required ratio rises accordingly.
The **required ratio** is determined by a consumption bracket: the more a member has consumed in total, the higher the minimum ratio they must maintain. Members who have contributed very little are subject to a higher required ratio; members who keep large volumes of high-quality content reliably available earn a lower required ratio through their coverage.

Two special flags on individual Contributions can modify how a download is counted:

**Freepass:** The consumer's *consumed* bytes are not accrued (they can download without ratio penalty), but the contributor's *contributed* bytes are still credited. Used to promote selected or staff-featured contributions and help members rebuild ratio.

**Neutralpass:** Neither *consumed* nor *contributed* are accrued. The item sits completely outside the ratio economy — useful for content that should not be subject to ratio accounting at all.

The ratio policy follows a three-state machine: **OK → WATCH → DL_DISABLED**. A member in WATCH has 14 days and a 10 GiB consumption allowance to restore their ratio before their download access is disabled. Once disabled, only staff can reverse the restriction.

===User Classes===

Members advance through a series of user classes — called **ranks** — based on their contribution activity. Progression is automatic: a background sweep runs hourly and evaluates each member against the criteria for their current and adjacent ranks. A member advances at most one rung per pass, and can be demoted if they no longer meet the criteria for their current rung.

The seven automatically-managed ranks are:

**User** — the base rank granted on registration. **Member** — the first earned rung; unlocks advanced search. **Power User** — elevated collage management. **Elite** — the top of the capability-granting range. **Stellarific, Stellartastic, Stellarige** — prestige tiers for long-tenured, high-volume contributors. These carry identity and expanded limits but no new site capabilities beyond Elite.

**Staff** and **SysOp** ranks are assigned by hand and are never reached or removed automatically.

Promotion criteria for each rung require meeting a minimum byte floor (drawn from the same live-link-gated pool used for ratio relief), a minimum ratio, a minimum number of contributions, and a minimum account age. The prestige tiers additionally require extra predicates: Stellartastic requires 500 distinct releases contributed to; Stellarige requires 500 non-scene, lossless (or log+cue) contributions. Staff can tune these thresholds through an admin promotion-criteria editor without a code deploy.

===Contribution Quality===

Not all contributions are equal. Stellar grades each music contribution by its rip quality:

**Perfect** — verified lossless rip (FLAC with log and cue sheet). Weighted 1.0. **Lossless** — FLAC without log/cue, or WAV. Weighted 0.9. **Lossy** — graded further by bitrate (320 kbps, V0, etc.).

The quality grade feeds the **CommunityScore** dimension of the CRS: high-quality contributions contribute more weight to a member's reputation than low-quality ones, and this weighting is symmetric — it amplifies both rewards (when the community is healthy) and penalties (when a community a member has contributed to is in poor health). A contribution's grade is permanent; the link-health of that contribution determines whether it continues to count toward ratio relief and CRS on an ongoing basis.

===Community Reputation Score (CRS)===

The **Community Reputation Score** is a composite reputation signal computed on read from multiple dimensions of a member's participation. It is advisory — it never directly gates access or enforces policy — but it surfaces as a visible indicator of a member's overall contribution to the ecosystem.

Dimensions include (among others):

**ContributionScore** — derived from a member's contribution volume, quality grades, and the ongoing link health of their contributions.
**RatioScore** — a bounded sub-score derived one-way from a member's current ratio health.
**IRCScore** — derived from a member's activity on the community IRC network (via the [korin.pink](https://github.com/obrien-k/korin-pink) IRC sidecar).
**StylesheetScore** — earned when other members adopt a stylesheet the member has authored.
**CommunityScore** — the signed health of the communities a member has contributed to, weighted by contribution quality. Healthy community → reward; struggling community → penalty.
CRS never feeds back into the ratio mechanism, and rank progression never reads CRS. These systems are strictly layered: enforcement mechanisms (ratio, rank) may produce signals that flow one-way into CRS, but CRS never triggers enforcement.

===Other Terms===

**Passkey:** A passkey identifies individual members on Stellar. Each member's passkey is unique and is embedded in the download URL that the platform constructs when a download is granted. The platform checks the passkey before granting access to a contribution and uses it to credit the correct member's consumed and contributed byte tallies. Your passkey must be kept strictly personal. A malicious actor who obtains your passkey could impersonate your download activity and have consumption counted against your ratio. If you suspect your passkey has been compromised, reset it immediately on your settings page.

**Invite Tree:** Stellar is invite-only. When a member invites someone, a link is created in the invite tree between inviter and invitee. This genealogy is used to detect **contagion** — a graded, distance-decaying suspicion that flows from a banned or ban-evading member down to their invitees. Contagion is suspect, not condemned: it is a signal that informs staff review, not an automatic punishment.

**Standing:** A member's five-rung governance tier — Pristine, Clean, Neutral, Poor, or Hammer — computed from active warnings, ban state, and account tenure. Standing scales the impact of rule compliance and violations on a member's CRS. It does not gate access directly.

**Collage:** A curated list of releases grouped by a member around a theme, artist, or concept. Collages are a social and discovery feature; the number a member may maintain grows with their rank.

**IRC / korin.pink:** [SITE_NAME] operates a community IRC network through the [korin.pink](https://github.com/obrien-k/korin-pink) sidecar service. When a new contribution is approved, an announcement is pushed to the IRC #announce channel with a link back into the site. Downloading a release always requires a logged-in, session-authenticated request — the announce link is a notify-and-link, not a direct download token.

====More Info:==== [Ratio — How the ratio system works](/wiki/ratio) [Contribution quality grades](wiki/contribution-quality) [Community Reputation Score (CRS)](wiki/community-reputation-score) [User classes and progression](wiki/user-classes)