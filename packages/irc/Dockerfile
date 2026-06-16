FROM ghcr.io/ergochat/ergo:stable
COPY ergo.yaml /etc/ergo.yaml
COPY motd.txt /etc/ergo/motd.txt
# The base image's default ENTRYPOINT (/ircd-bin/run.sh) boots *stock* Ergo —
# default ircd.yaml, a generated `admin` oper, self-signed certs — and swallows
# a plain CMD, so our config never loads. Bypass the wrapper and launch the
# ergo binary directly against our config (matches the boot test invocation).
ENTRYPOINT ["/ircd-bin/ergo"]
CMD ["run", "--conf", "/etc/ergo.yaml"]
