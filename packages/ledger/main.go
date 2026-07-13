// Command ledger is korin.pink's hot-path accounting service (ADR-004), the
// consumer side of the ADR-0016 consumption-accounting & ratio-gate contract.
//
// It is a DERIVED read-model, not a parallel authority: stellar-api is the system
// of record and the origin of every consumption event. On boot korin seeds an
// in-memory working set from stellar's snapshot, advances it with pre-resolved
// grant deltas (POST /ledger/consumption), and answers the grant-time gate
// (GET /ledger/can-consume) and live stats (GET /ledger/stats). It owns no numbers
// to flush back (stellar already persisted the truth). On restart it reloads the
// snapshot; an unflushed window is bounded loss, not corruption
// (docs/adr/003-irc-bridge-state.md).
//
// Because stellar's /ledger/sync producer is deferred (stellar #324), a periodic
// snapshot re-pull keeps policy/contribution state fresh between reboots.
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var requests atomic.Uint64

func main() {
	cfg := loadConfig()
	st := newStore()

	// Buffered events channel feeds the single applier goroutine — the ADR-004
	// pattern: handlers enqueue and return, one consumer mutates the working set.
	events := make(chan consumptionEvent, 1024)
	srv := &server{cfg: cfg, store: st, events: events}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Boot seed. A failure (unset keys / stellar down) degrades open: the working
	// set stays empty and can-consume fails open (unknown user ⇒ allow).
	if snap, err := fetchSnapshot(ctx, cfg); err != nil {
		log.Printf("boot snapshot seed skipped: %v", err)
	} else {
		st.seed(snap)
		log.Printf("seeded from snapshot: %d users, %d contributions (generatedAt=%s)",
			len(snap.Users), len(snap.Contributions), snap.GeneratedAt)
	}

	snapshots := make(chan *ledgerSnapshot, 1)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); runApplier(ctx, st, events, snapshots) }()
	go func() { defer wg.Done(); runRefresh(ctx, cfg, snapshots) }()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "requests": requests.Load()})
	})
	pull := func(h http.HandlerFunc) http.HandlerFunc { return requirePullKey(cfg.stellarPullKey, h) }
	mux.HandleFunc("POST /ledger/consumption", pull(srv.handleConsumption))
	mux.HandleFunc("GET /ledger/can-consume", pull(srv.handleCanConsume))
	mux.HandleFunc("GET /ledger/stats", pull(srv.handleStats))

	httpSrv := &http.Server{Addr: ":" + cfg.port, Handler: count(mux), ReadHeaderTimeout: 5 * time.Second}

	go func() {
		log.Printf("ledger listening on :%s (snapshot refresh every %s)", cfg.port, cfg.refreshInterval)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down…")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutCtx)
	wg.Wait() // applier drains buffered events before returning
	log.Println("bye")
}

// runApplier is the single writer. It applies consumption events and installs
// snapshot reseeds; on shutdown it drains buffered events before returning.
func runApplier(ctx context.Context, st *store, events <-chan consumptionEvent, snapshots <-chan *ledgerSnapshot) {
	for {
		select {
		case e := <-events:
			st.apply(e)
		case snap := <-snapshots:
			st.seed(snap)
		case <-ctx.Done():
			for {
				select {
				case e := <-events:
					st.apply(e)
				default:
					return
				}
			}
		}
	}
}

// runRefresh re-pulls the snapshot on a ticker and hands it to the applier. A
// failed pull is logged and skipped — the applier keeps the last-good working set.
func runRefresh(ctx context.Context, cfg config, snapshots chan<- *ledgerSnapshot) {
	t := time.NewTicker(cfg.refreshInterval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			snap, err := fetchSnapshot(ctx, cfg)
			if err != nil {
				log.Printf("snapshot refresh failed (keeping last good): %v", err)
				continue
			}
			select {
			case snapshots <- snap:
			case <-ctx.Done():
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func count(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		next.ServeHTTP(w, r)
	})
}
