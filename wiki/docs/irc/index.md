---
id: irc-index
title: IRC
sidebar_label: Overview
---

# IRC on korin.pink

korin.pink runs **[Ergo](https://ergo.chat/)** — a modern, self-contained IRCv3 server written in Go.

Features active on this server:

- **TLS** on port `6697` — plaintext connections are rejected
- **SASL PLAIN** authentication — nick registration is handled server-side
- **Message history** — server-side scrollback via IRCv3 (`CHATHISTORY`)
- **Account-tagged messages** — your account name follows you across nick changes
- **Always-on clients** — `BOUNCER` and persistent sessions via Ergo's built-in bouncer

## Why IRC?

No tracking, no client-side JavaScript surveillance, no SaaS dependency. You own your client. Ergo is open source and can be self-hosted by any `korin.{color}` instance.

## Quick start

1. [Connect to the server](connecting) with a client of your choice
2. Register your nick with `SASL PLAIN` or `/MSG NickServ REGISTER <password> <email>`
3. Join `#stellar` and say hi
4. Link your Ergo nick to your Stellar account → `PUT /api/users/:id/irc-nick`
5. Watch your [IRCScore](irc-score) climb

## Resources

- [How to connect](connecting)
- [Channel directory](channels)
- [Community etiquette](etiquette)
- [IRCScore explained](irc-score)
