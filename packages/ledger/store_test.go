package main

import "testing"

func ev(grantID int64, kind string, userID, contributorID int64, consumed, contributed string) consumptionEvent {
	return consumptionEvent{
		GrantID: grantID, Kind: kind, UserID: userID, ContributorID: contributorID,
		ConsumedDelta: consumed, ContributedDelta: contributed, Pass: "none", At: "2026-07-13T00:00:00Z",
	}
}

func TestApplySplitsConsumerAndContributor(t *testing.T) {
	s := newStore()
	// User 1 consumes 1000 bytes of user 2's contribution.
	s.apply(ev(1, "grant", 1, 2, "1000", "1000"))

	if got := s.users[1].consumed.String(); got != "1000" {
		t.Errorf("consumer consumed = %s, want 1000", got)
	}
	if got := s.users[1].contributed.String(); got != "0" {
		t.Errorf("consumer contributed = %s, want 0 (credit belongs to contributor)", got)
	}
	if got := s.users[2].contributed.String(); got != "1000" {
		t.Errorf("contributor contributed = %s, want 1000", got)
	}
	if got := s.users[2].consumed.String(); got != "0" {
		t.Errorf("contributor consumed = %s, want 0", got)
	}
}

func TestReversalNetsToZero(t *testing.T) {
	s := newStore()
	s.apply(ev(7, "grant", 1, 2, "1000", "1000"))
	// A reversal shares grantId, opposite kind, negated deltas (stellar pre-signs).
	s.apply(ev(7, "reversal", 1, 2, "-1000", "-1000"))

	if got := s.users[1].consumed.String(); got != "0" {
		t.Errorf("consumed after reversal = %s, want 0", got)
	}
	if got := s.users[2].contributed.String(); got != "0" {
		t.Errorf("contributed after reversal = %s, want 0", got)
	}
}

func TestFreepassLeavesConsumerUndebited(t *testing.T) {
	s := newStore()
	// Freepass is pre-resolved upstream: consumedDelta 0, contributor still credited.
	s.apply(ev(3, "grant", 1, 2, "0", "1000"))
	if got := s.users[1].consumed.String(); got != "0" {
		t.Errorf("freepass consumer consumed = %s, want 0", got)
	}
	if got := s.users[2].contributed.String(); got != "1000" {
		t.Errorf("freepass contributor contributed = %s, want 1000", got)
	}
}

func TestApplyIdempotentOnGrantIDKind(t *testing.T) {
	s := newStore()
	if !s.apply(ev(9, "grant", 1, 2, "500", "500")) {
		t.Fatal("first apply should return true")
	}
	if s.apply(ev(9, "grant", 1, 2, "500", "500")) {
		t.Error("duplicate (grantId, kind) should be a no-op (false)")
	}
	if got := s.users[1].consumed.String(); got != "500" {
		t.Errorf("consumed after duplicate = %s, want 500 (counted once)", got)
	}
	// Same grantId, different kind is NOT a duplicate.
	if !s.apply(ev(9, "reversal", 1, 2, "-500", "-500")) {
		t.Error("reversal of a seen grant should apply")
	}
}

func TestVerdictFailsOpenForUnknownUser(t *testing.T) {
	s := newStore()
	v := s.verdict(999)
	if !v.Allow || v.PolicyState != policyOK {
		t.Errorf("unknown user verdict = %+v, want allow/OK", v)
	}
}

func TestVerdictBlocksLeechDisabled(t *testing.T) {
	s := newStore()
	s.seed(&ledgerSnapshot{Users: []snapUser{
		{ID: 1, Contributed: "10", Consumed: "100", CanDownload: false, PolicyState: policyLeechDisable},
	}})
	v := s.verdict(1)
	if v.Allow {
		t.Error("LEECH_DISABLED user should not be allowed")
	}
	if v.Reason != policyLeechDisable {
		t.Errorf("reason = %q, want %q", v.Reason, policyLeechDisable)
	}
}

func TestStatsWindowCounters(t *testing.T) {
	s := newStore()
	s.apply(ev(1, "grant", 1, 2, "100", "100"))
	s.apply(ev(2, "grant", 3, 2, "200", "200"))
	p := s.statsSnapshot()
	if p.Global.Events != 2 {
		t.Errorf("events = %d, want 2", p.Global.Events)
	}
	if p.Global.ActiveConsumers != 2 { // users 1 and 3
		t.Errorf("activeConsumers = %d, want 2", p.Global.ActiveConsumers)
	}
	if p.Global.ActiveContributors != 1 { // user 2 both times
		t.Errorf("activeContributors = %d, want 1", p.Global.ActiveContributors)
	}
	if p.Global.WindowConsumedBytes != "300" {
		t.Errorf("windowConsumedBytes = %s, want 300", p.Global.WindowConsumedBytes)
	}
}
