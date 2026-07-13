package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
)

// ledgerSnapshot mirrors stellar-api's LedgerSnapshot (src/modules/ledger.ts) — the
// durable state korin pulls to seed/reseed its working set (ADR-0016 snapshot flow).
type ledgerSnapshot struct {
	GeneratedAt   string             `json:"generatedAt"`
	Users         []snapUser         `json:"users"`
	Contributions []snapContribution `json:"contributions"`
}

type snapUser struct {
	ID          int64  `json:"id"`
	Contributed string `json:"contributed"`
	Consumed    string `json:"consumed"`
	CanDownload bool   `json:"canDownload"`
	PolicyState string `json:"policyState"`
}

type snapContribution struct {
	ID                      int64   `json:"id"`
	UserID                  int64   `json:"userId"`
	ApprovedAccountingBytes *string `json:"approvedAccountingBytes"` // null ⇒ unapproved
	LinkStatus              string  `json:"linkStatus"`
	RatioExempt             string  `json:"ratioExempt"`
}

// fetchSnapshot pulls GET {stellarURL}/api/ledger/snapshot with Bearer
// STELLAR_API_KEY. Returns an error (never a partial) on unset keys / non-2xx /
// transport failure so the caller keeps its last-good working set.
func fetchSnapshot(ctx context.Context, cfg config) (*ledgerSnapshot, error) {
	if cfg.stellarURL == "" || cfg.stellarKey == "" {
		return nil, fmt.Errorf("STELLAR_API_URL/STELLAR_API_KEY unset — snapshot seed skipped")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.stellarURL+"/api/ledger/snapshot", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.stellarKey)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("snapshot GET → %d", res.StatusCode)
	}

	var snap ledgerSnapshot
	if err := json.NewDecoder(res.Body).Decode(&snap); err != nil {
		return nil, fmt.Errorf("decode snapshot: %w", err)
	}
	return &snap, nil
}

// parseBig reads a base-10 BigInt string, defaulting to 0 on garbage.
func parseBig(s string) *big.Int {
	n, ok := new(big.Int).SetString(s, 10)
	if !ok {
		return new(big.Int)
	}
	return n
}

// seed rebuilds the working set from a snapshot and installs it atomically. The
// snapshot is authoritative for balances as of generatedAt, so this REPLACES totals
// (self-healing — it never double-counts events already folded into the snapshot)
// and resets the idempotency window and activity counters. A user leech-disabled
// after boot becomes visible here (the periodic-repull bridge for deferred
// /ledger/sync).
func (s *store) seed(snap *ledgerSnapshot) {
	users := make(map[int64]*userState, len(snap.Users))
	for _, u := range snap.Users {
		state := u.PolicyState
		if state == "" {
			state = policyOK
		}
		users[u.ID] = &userState{
			contributed:   parseBig(u.Contributed),
			consumed:      parseBig(u.Consumed),
			canDownload:   u.CanDownload,
			policyState:   state,
			eligibleBytes: new(big.Int),
		}
	}

	contribs := make(map[int64]*contribState, len(snap.Contributions))
	for _, c := range snap.Contributions {
		cs := &contribState{
			userID:      c.UserID,
			linkStatus:  c.LinkStatus,
			ratioExempt: c.RatioExempt,
		}
		if c.ApprovedAccountingBytes != nil {
			cs.approvedAccountingBytes = parseBig(*c.ApprovedAccountingBytes)
		}
		contribs[c.ID] = cs

		// A live, staff-approved link counts toward its contributor's coverage.
		if cs.approvedAccountingBytes != nil && c.LinkStatus != linkFail {
			owner := users[c.UserID]
			if owner == nil {
				owner = newUserState()
				users[c.UserID] = owner
			}
			owner.eligibleBytes.Add(owner.eligibleBytes, cs.approvedAccountingBytes)
		}
	}

	s.mu.Lock()
	s.reset(users, contribs)
	s.mu.Unlock()
}
