// Command ledger is korin.pink's hot-path accounting service (ADR-004).
//
// It holds a recoverable in-memory working set of consumption accounting and
// flushes batched summaries to stellar-api over the shared-secret back-channel
// (stellar-api ADR-0013). Stellar remains the system of record; an unflushed
// window is bounded loss, not corruption (see docs/adr/003-irc-bridge-state.md).
//
// Phase 0 skeleton: config, an HTTP server with /healthz, the in-memory store +
// channel-fed batched-flush goroutine that embodies the pattern, and graceful
// shutdown. Consumption-event ingestion and the real flush body land in Phase
// 1/2 once the stellar-api contracts exist.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type config struct {
	port          string
	flushInterval time.Duration
	stellarURL    string // STELLAR_API_URL — flush target (system of record)
	stellarKey    string // STELLAR_API_KEY — Bearer for the shared-secret channel
}

func loadConfig() config {
	return config{
		port:          env("LEDGER_PORT", "3001"),
		flushInterval: time.Duration(envInt("LEDGER_FLUSH_INTERVAL_MS", 60000)) * time.Millisecond,
		stellarURL:    os.Getenv("STELLAR_API_URL"),
		stellarKey:    os.Getenv("STELLAR_API_KEY"),
	}
}

// consumptionEvent is one accounted consumption — a member consuming a
// Contribution. Phase 2 fleshes out the fields and the ingestion endpoint.
type consumptionEvent struct {
	UserID         int64 `json:"userId"`
	ContributionID int64 `json:"contributionId"`
	Bytes          int64 `json:"bytes"`
}

// store is the in-memory authoritative working set (the contribution_list
// analog). Sharding/eviction come later; Phase 0 uses one map under an RWMutex.
type store struct {
	mu       sync.RWMutex
	consumed map[int64]int64 // userID -> bytes accumulated since last flush
}

func newStore() *store { return &store{consumed: make(map[int64]int64)} }

func (s *store) record(e consumptionEvent) {
	s.mu.Lock()
	s.consumed[e.UserID] += e.Bytes
	s.mu.Unlock()
}

// drain atomically takes and clears the accumulated window for a flush.
func (s *store) drain() map[int64]int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.consumed) == 0 {
		return nil
	}
	w := s.consumed
	s.consumed = make(map[int64]int64)
	return w
}

var requests atomic.Uint64

func main() {
	cfg := loadConfig()
	st := newStore()

	// Buffered events channel feeds the single flush goroutine — replaces the
	// lock-guarded flush queues of a threaded design. Handlers never block.
	events := make(chan consumptionEvent, 1024)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() { defer wg.Done(); runFlusher(ctx, cfg, st, events) }()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "requests": requests.Load()})
	})
	// Phase 2: mux.HandleFunc("POST /consumption", ...) -> events <- consumptionEvent{...}

	srv := &http.Server{Addr: ":" + cfg.port, Handler: count(mux), ReadHeaderTimeout: 5 * time.Second}

	go func() {
		log.Printf("ledger listening on :%s (flush every %s)", cfg.port, cfg.flushInterval)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down…")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
	wg.Wait() // flusher does a final flush on ctx cancel
	log.Println("bye")
}

// runFlusher accumulates consumption into the store and flushes a batched
// summary every flushInterval. On shutdown it drains buffered events and does a
// final flush. Phase 2 replaces flush() with the stellar-api call.
func runFlusher(ctx context.Context, cfg config, st *store, events <-chan consumptionEvent) {
	t := time.NewTicker(cfg.flushInterval)
	defer t.Stop()
	for {
		select {
		case e := <-events:
			st.record(e)
		case <-t.C:
			flush(cfg, st.drain())
		case <-ctx.Done():
			for {
				select {
				case e := <-events:
					st.record(e)
				default:
					flush(cfg, st.drain())
					return
				}
			}
		}
	}
}

// flush is a stub. Phase 2 POSTs the window to stellar-api over the shared
// secret (Bearer STELLAR_API_KEY). For now it reports the window size.
func flush(cfg config, window map[int64]int64) {
	if len(window) == 0 {
		return
	}
	log.Printf("flush: %d members accounted (target=%s) [stub]", len(window), cfg.stellarURL)
}

func count(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
