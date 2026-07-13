package main

import (
	"fmt"
	"math/big"
	"sync"
)

// Policy states and link/pass enum values, mirrored from stellar's Prisma enums.
const (
	policyOK           = "OK"
	policyLeechDisable = "LEECH_DISABLED"
	linkFail           = "FAIL"
)

// consumptionEvent is one pre-resolved accounting delta pushed by stellar
// (ADR-0016). Deltas are BigInt-as-string byte counts; a reversal carries the
// negatives of its grant. stellar has already resolved passes (Freepass ⇒
// consumedDelta 0; Neutralpass ⇒ both 0), so korin only sums — never re-derives.
type consumptionEvent struct {
	GrantID          int64  `json:"grantId"`
	Kind             string `json:"kind"` // "grant" | "reversal"
	UserID           int64  `json:"userId"`
	ContributorID    int64  `json:"contributorId"`
	ContributionID   int64  `json:"contributionId"`
	ConsumedDelta    string `json:"consumedDelta"`
	ContributedDelta string `json:"contributedDelta"`
	Pass             string `json:"pass"`
	At               string `json:"at"`
}

// userState is a consumer/contributor's live balance + gate state. `canDownload`
// is stellar's authoritative gate flag (false ⟺ LEECH_DISABLED); it drives allow.
type userState struct {
	contributed   *big.Int
	consumed      *big.Int
	canDownload   bool
	policyState   string
	eligibleBytes *big.Int // Σ approvedAccountingBytes over live links (informational)
}

type contribState struct {
	userID                  int64
	approvedAccountingBytes *big.Int // nil ⇒ not staff-approved
	linkStatus              string
	ratioExempt             string
}

// store is korin's in-memory derived read-model (the contribution_list analog).
// A single applier goroutine mutates it (apply/seed); handlers read under RLock.
type store struct {
	mu            sync.RWMutex
	users         map[int64]*userState
	contributions map[int64]*contribState
	seen          map[string]struct{} // idempotency window, key "grantId:kind"

	// Current-window activity counters (reset by seed), for /ledger/stats.
	winEvents       int64
	winConsumed     *big.Int
	winContributed  *big.Int
	winConsumers    map[int64]struct{}
	winContributors map[int64]struct{}
}

func newStore() *store {
	s := &store{}
	s.reset(nil, nil)
	return s
}

// reset installs fresh maps and zeroes the window. Called under lock by seed and
// once at construction.
func (s *store) reset(users map[int64]*userState, contribs map[int64]*contribState) {
	if users == nil {
		users = make(map[int64]*userState)
	}
	if contribs == nil {
		contribs = make(map[int64]*contribState)
	}
	s.users = users
	s.contributions = contribs
	s.seen = make(map[string]struct{})
	s.winEvents = 0
	s.winConsumed = new(big.Int)
	s.winContributed = new(big.Int)
	s.winConsumers = make(map[int64]struct{})
	s.winContributors = make(map[int64]struct{})
}

func seenKey(grantID int64, kind string) string {
	return fmt.Sprintf("%d:%s", grantID, kind)
}

// newUserState is the fail-open default row (OK / canDownload) for a user we've
// seen an event for but not a snapshot — created here and in seed's contributor
// fallback, so the default lives in one place.
func newUserState() *userState {
	return &userState{
		contributed:   new(big.Int),
		consumed:      new(big.Int),
		canDownload:   true,
		policyState:   policyOK,
		eligibleBytes: new(big.Int),
	}
}

// user returns the state for id, creating the fail-open default when unseen.
// Caller holds the write lock.
func (s *store) user(id int64) *userState {
	u := s.users[id]
	if u == nil {
		u = newUserState()
		s.users[id] = u
	}
	return u
}

// apply sums one event into the working set. Idempotent on (grantId, kind):
// a duplicate is a no-op. Returns true if applied (false ⇒ duplicate/invalid).
func (s *store) apply(e consumptionEvent) bool {
	cd, ok1 := new(big.Int).SetString(e.ConsumedDelta, 10)
	td, ok2 := new(big.Int).SetString(e.ContributedDelta, 10)
	if !ok1 || !ok2 {
		return false // malformed BigInt string; drop (validated at the handler too)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	key := seenKey(e.GrantID, e.Kind)
	if _, dup := s.seen[key]; dup {
		return false
	}
	s.seen[key] = struct{}{}

	// The two deltas land on two different rows: the consumer (userId) is debited
	// `consumedDelta`, the contributor (contributorId) is credited `contributedDelta`
	// — exactly stellar's grant accrual. A pass zeroes one or both sides upstream.
	consumer := s.user(e.UserID)
	consumer.consumed.Add(consumer.consumed, cd)
	contributor := s.user(e.ContributorID)
	contributor.contributed.Add(contributor.contributed, td)

	// Window counters.
	s.winEvents++
	s.winConsumed.Add(s.winConsumed, cd)
	s.winContributed.Add(s.winContributed, td)
	s.winConsumers[e.UserID] = struct{}{}
	s.winContributors[e.ContributorID] = struct{}{}
	return true
}

// statsSnapshot copies out a stable view for the stats handler. Caller must not
// hold the lock; it takes RLock itself.
func (s *store) statsSnapshot() statsPayload {
	s.mu.RLock()
	defer s.mu.RUnlock()

	users := make([]statsUser, 0, len(s.users))
	for id, u := range s.users {
		users = append(users, statsUser{
			ID:           id,
			Consumed:     u.consumed.String(),
			Contributed:  u.contributed.String(),
			CurrentRatio: computeRatio(u.contributed, u.consumed),
			PolicyState:  u.policyState,
		})
	}
	return statsPayload{
		Global: statsGlobal{
			Users:                  len(s.users),
			Contributions:          len(s.contributions),
			ActiveConsumers:        len(s.winConsumers),
			ActiveContributors:     len(s.winContributors),
			WindowConsumedBytes:    s.winConsumed.String(),
			WindowContributedBytes: s.winContributed.String(),
			Events:                 s.winEvents,
		},
		Users: users,
	}
}

// verdict computes the can-consume answer for a user. Unknown user ⇒ fail-open
// (allow, OK). allow rides canDownload (false ⟺ LEECH_DISABLED in stellar).
func (s *store) verdict(userID int64) canConsumeVerdict {
	s.mu.RLock()
	defer s.mu.RUnlock()

	u := s.users[userID]
	if u == nil {
		return canConsumeVerdict{Allow: true, CurrentRatio: 1.0, RequiredRatio: 0, PolicyState: policyOK}
	}
	v := canConsumeVerdict{
		Allow:         u.canDownload,
		CurrentRatio:  computeRatio(u.contributed, u.consumed),
		RequiredRatio: computeRequiredRatio(u.consumed, u.eligibleBytes),
		PolicyState:   u.policyState,
	}
	if !v.Allow {
		v.Reason = u.policyState
	}
	return v
}
