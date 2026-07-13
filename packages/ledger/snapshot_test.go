package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func strptr(s string) *string { return &s }

func TestSeedBalancesAndPolicyDefault(t *testing.T) {
	s := newStore()
	s.seed(&ledgerSnapshot{Users: []snapUser{
		{ID: 1, Contributed: "5000", Consumed: "0", CanDownload: true, PolicyState: ""}, // empty ⇒ OK
		{ID: 2, Contributed: "0", Consumed: "1000", CanDownload: true, PolicyState: "WATCH"},
	}})

	if s.users[1].policyState != policyOK {
		t.Errorf("empty policyState should default to OK, got %q", s.users[1].policyState)
	}
	if s.users[2].policyState != "WATCH" {
		t.Errorf("policyState = %q, want WATCH", s.users[2].policyState)
	}
	if s.users[1].contributed.String() != "5000" {
		t.Errorf("contributed = %s, want 5000", s.users[1].contributed.String())
	}
}

func TestSeedEligibleBytesExcludesFailAndUnapproved(t *testing.T) {
	s := newStore()
	s.seed(&ledgerSnapshot{
		Users: []snapUser{{ID: 1, Contributed: "0", Consumed: "0", CanDownload: true, PolicyState: "OK"}},
		Contributions: []snapContribution{
			{ID: 10, UserID: 1, ApprovedAccountingBytes: strptr("1000"), LinkStatus: "PASS", RatioExempt: "NONE"},
			{ID: 11, UserID: 1, ApprovedAccountingBytes: strptr("2000"), LinkStatus: "FAIL", RatioExempt: "NONE"}, // dead link excluded
			{ID: 12, UserID: 1, ApprovedAccountingBytes: nil, LinkStatus: "PASS", RatioExempt: "NONE"},            // unapproved excluded
			{ID: 13, UserID: 1, ApprovedAccountingBytes: strptr("500"), LinkStatus: "WARN", RatioExempt: "NONE"},  // WARN still counts
		},
	})
	if got := s.users[1].eligibleBytes.String(); got != "1500" { // 1000 + 500
		t.Errorf("eligibleBytes = %s, want 1500 (PASS+WARN, excluding FAIL and unapproved)", got)
	}
}

func TestSeedIsSelfHealingReplace(t *testing.T) {
	s := newStore()
	s.apply(ev(1, "grant", 1, 2, "999", "999")) // live event advances the set
	// A later snapshot is authoritative and REPLACES totals (no double count).
	s.seed(&ledgerSnapshot{Users: []snapUser{
		{ID: 1, Contributed: "0", Consumed: "100", CanDownload: true, PolicyState: "OK"},
	}})
	if got := s.users[1].consumed.String(); got != "100" {
		t.Errorf("consumed after reseed = %s, want 100 (snapshot replaces)", got)
	}
	if len(s.seen) != 0 {
		t.Errorf("seed should reset the idempotency window, len=%d", len(s.seen))
	}
}

func TestFetchSnapshotUnsetKeys(t *testing.T) {
	if _, err := fetchSnapshot(context.Background(), config{}); err == nil {
		t.Error("expected error when STELLAR_API_URL/KEY unset")
	}
}

func TestFetchSnapshotHappyPathAndAuthHeader(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		if r.URL.Path != "/api/ledger/snapshot" {
			w.WriteHeader(404)
			return
		}
		_ = json.NewEncoder(w).Encode(ledgerSnapshot{
			GeneratedAt: "2026-07-13T00:00:00Z",
			Users:       []snapUser{{ID: 1, Contributed: "1", Consumed: "2", CanDownload: true, PolicyState: "OK"}},
		})
	}))
	defer srv.Close()

	snap, err := fetchSnapshot(context.Background(), config{stellarURL: srv.URL, stellarKey: "sekret"})
	if err != nil {
		t.Fatalf("fetchSnapshot: %v", err)
	}
	if gotAuth != "Bearer sekret" {
		t.Errorf("Authorization = %q, want Bearer sekret", gotAuth)
	}
	if len(snap.Users) != 1 || snap.Users[0].Consumed != "2" {
		t.Errorf("decoded snapshot wrong: %+v", snap)
	}
}

func TestFetchSnapshotNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()
	if _, err := fetchSnapshot(context.Background(), config{stellarURL: srv.URL, stellarKey: "k"}); err == nil {
		t.Error("expected error on non-2xx snapshot response")
	}
}
