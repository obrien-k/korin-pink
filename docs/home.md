# Agent Documentation

## Documentation Map

| Document                        | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| CLAUDE.md                       | Claude Code setup, commands, session conventions          |
| AGENTS.md                       | Repository workflow, architecture, coding patterns        |
| CONTEXT.md                      | Current project and domain context                        |
| docs/adr/                       | Architectural decision records                            |
| docs/agents/issue-tracker.md    | GitHub issue workflow                                     |
| docs/agents/triage-labels.md    | Standard label definitions                                |
| docs/agents/domain.md           | Domain-specific guidance (Korin scheme, Stellar CRS)      |

---

## Introduction

Salutations! This document is the entry point for agents and contributors working in `obrien-k/korin-omnibus`.

`korin-omnibus` is the canonical knowledge base and coordination repository for the **Korin color scheme** — a collection of community infrastructure deployments under the `korin.{color}` naming convention.

The first and primary instance is **korin.pink**, which serves as IRC infrastructure for the [Stellar](https://github.com/orphic-inc/stellar-api) platform, contributing to the Community Reputation Score (CRS) via IRC activity signals.

---

## Repositories

| Repository                       | Role                                              |
| -------------------------------- | ------------------------------------------------- |
| `obrien-k/korin-omnibus`         | Docs, wiki, coordination (this repo)              |
| `obrien-k/korin-pink`            | korin.pink monorepo — IRC, API, web, bridge       |
| `orphic-inc/stellar-api`         | Upstream platform; consumer of IRC metrics        |

---

## Connecting to Infrastructure

### korin.pink (GCP default)

Requires GCP service account with Cloud SQL Client, Drive, and Gmail scopes.
Use the service account JSON as `GOOGLE_APPLICATION_CREDENTIALS`.

### stellar-api

Issues live at `orphic-inc/stellar-api`. stellar-api **pulls** raw IRC signals from `GET /irc/metrics`; release announces arrive via `POST /irc/announce` (stellar-api ADR-0013 §Integration contract). korin does **not** push metrics to stellar.
See `docs/domain.md` for the integration contract.

---

## Issue Tracker

Issues are filed in `obrien-k/korin-omnibus` for omnibus-level concerns (docs, naming, cross-repo coordination) and in `obrien-k/korin-pink` for implementation work.

See `docs/agents/issue-tracker.md`.

## Triage Labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.

See `docs/agents/triage-labels.md`.

## Domain Docs

Single-context per repo — one `CONTEXT.md` + `docs/adr/` at the repo root.

See `docs/agents/domain.md`.
