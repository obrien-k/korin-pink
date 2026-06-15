---
id: irc-connecting
title: Connecting to IRC
sidebar_label: Connecting
---

# Connecting to korin.pink IRC

## Server details

| Field    | Value            |
| -------- | ---------------- |
| Host     | `irc.korin.pink` |
| Port     | `6697`           |
| TLS      | **required**     |
| SASL     | PLAIN            |

Plaintext port 6667 is **not available**. All connections require TLS.

---

## Client setup

### WeeChat

```
/server add korin irc.korin.pink/6697 -ssl
/set irc.server.korin.sasl_mechanism PLAIN
/set irc.server.korin.sasl_username YOUR_NICK
/set irc.server.korin.sasl_password YOUR_PASSWORD
/connect korin
```

### irssi

```
/network add korin
/server add -auto -network korin -ssl -ssl_verify irc.korin.pink 6697
/set -network korin sasl_mechanism plain
/set -network korin sasl_username YOUR_NICK
/set -network korin sasl_password YOUR_PASSWORD
/connect korin
```

### Senpai (recommended for IRCv3)

`~/.config/senpai/senpai.scfg`:

```
address irc.korin.pink:6697
nick YOUR_NICK
password YOUR_PASSWORD
tls true
```

### Catgirl

```
catgirl -h irc.korin.pink -p 6697 -n YOUR_NICK -w YOUR_PASSWORD
```

### Textual / LimeChat (macOS GUI)

Connection settings: **Server**: `irc.korin.pink`, **Port**: `6697`, **SSL**: enabled. Under Login Info → set SASL auth with your nick and password.

---

## Nick registration

If you don't have an account yet, connect with TLS and register:

```
/MSG NickServ REGISTER <password> <email>
```

After registration, configure your client to authenticate via SASL PLAIN (see above) so you're always logged in on connect.

---

## Linking to your Stellar account

Once you have an Ergo nick, link it to earn [IRCScore](irc-score):

```
PUT /api/users/:id/irc-nick
{ "ircNick": "your_nick" }
```

This requires a valid Stellar session cookie. The nick must be unique across all Stellar accounts. See the [Stellar API docs](https://github.com/orphic-inc/stellar-api) for endpoint details.
