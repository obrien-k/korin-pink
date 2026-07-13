package main

import (
	"encoding/json"
	"math/big"
	"net/http"
	"strconv"
	"time"
)

// canConsumeVerdict is the ADR-0016 ratio-gate response. `allow` rides the
// consumer's canDownload flag; currentRatio/requiredRatio are informational.
type canConsumeVerdict struct {
	Allow         bool    `json:"allow"`
	Reason        string  `json:"reason,omitempty"`
	CurrentRatio  float64 `json:"currentRatio"`
	RequiredRatio float64 `json:"requiredRatio"`
	PolicyState   string  `json:"policyState"`
}

type statsPayload struct {
	GeneratedAt string      `json:"generatedAt"`
	Global      statsGlobal `json:"global"`
	Users       []statsUser `json:"users"`
}

type statsGlobal struct {
	Users                  int    `json:"users"`
	Contributions          int    `json:"contributions"`
	ActiveConsumers        int    `json:"activeConsumers"`
	ActiveContributors     int    `json:"activeContributors"`
	WindowConsumedBytes    string `json:"windowConsumedBytes"`
	WindowContributedBytes string `json:"windowContributedBytes"`
	Events                 int64  `json:"events"`
}

type statsUser struct {
	ID           int64   `json:"id"`
	Consumed     string  `json:"consumed"`
	Contributed  string  `json:"contributed"`
	CurrentRatio float64 `json:"currentRatio"`
	PolicyState  string  `json:"policyState"`
}

// server carries the handler dependencies: the working set and the applier
// channel (handlers never touch the store's write path directly).
type server struct {
	cfg    config
	store  *store
	events chan consumptionEvent
}

// handleConsumption ingests one pre-resolved event. It validates then hands off to
// the single applier goroutine, so the handler never blocks on the working-set
// lock. A duplicate (grantId, kind) still returns 200 — the applier no-ops it.
func (srv *server) handleConsumption(w http.ResponseWriter, r *http.Request) {
	var e consumptionEvent
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}
	if e.Kind != "grant" && e.Kind != "reversal" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "kind must be grant or reversal"})
		return
	}
	if _, ok := new(big.Int).SetString(e.ConsumedDelta, 10); !ok {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "consumedDelta not a base-10 integer"})
		return
	}
	if _, ok := new(big.Int).SetString(e.ContributedDelta, 10); !ok {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "contributedDelta not a base-10 integer"})
		return
	}
	srv.events <- e
	writeJSON(w, http.StatusOK, map[string]any{"status": "accepted"})
}

// handleCanConsume answers the grant-time gate. Unknown user ⇒ fail-open (allow).
func (srv *server) handleCanConsume(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	userID, err := strconv.ParseInt(q.Get("userId"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "userId required"})
		return
	}
	// contributionId is part of the contract; validate its presence even though the
	// allow decision rides the consumer's policy state, not the contribution.
	if _, err := strconv.ParseInt(q.Get("contributionId"), 10, 64); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "contributionId required"})
		return
	}
	writeJSON(w, http.StatusOK, srv.store.verdict(userID))
}

func (srv *server) handleStats(w http.ResponseWriter, r *http.Request) {
	p := srv.store.statsSnapshot()
	p.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	writeJSON(w, http.StatusOK, p)
}
