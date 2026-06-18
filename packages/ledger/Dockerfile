# Multi-stage build for the ledger accounting service (ADR-004).
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/ledger .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ledger /ledger
EXPOSE 3001
USER nonroot:nonroot
ENTRYPOINT ["/ledger"]
