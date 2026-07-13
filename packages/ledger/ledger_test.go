package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testPullKey = "pull-secret"

// newTestServer wires a server whose applier is synchronous: the events channel is
// drained by the test via drain(), so accounting effects are deterministic.
func newTestServer() *server {
	return &server{
		cfg:    config{stellarPullKey: testPullKey},
		store:  newStore(),
		events: make(chan consumptionEvent, 16),
	}
}

// drain applies everything queued on the events channel (stands in for runApplier).
func (srv *server) drain() {
	for {
		select {
		case e := <-srv.events:
			srv.store.apply(e)
		default:
			return
		}
	}
}

func TestPullKeyAuth(t *testing.T) {
	srv := newTestServer()
	h := requirePullKey(srv.cfg.stellarPullKey, srv.handleStats)

	// Missing header → 401.
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/ledger/stats", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("missing key: code = %d, want 401", rec.Code)
	}

	// Wrong header → 401.
	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ledger/stats", nil)
	req.Header.Set("x-pull-key", "nope")
	h(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("wrong key: code = %d, want 401", rec.Code)
	}

	// Correct header → 200.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/ledger/stats", nil)
	req.Header.Set("x-pull-key", testPullKey)
	h(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("correct key: code = %d, want 200", rec.Code)
	}
}

func TestPullKeyFailsClosedWhenUnset(t *testing.T) {
	h := requirePullKey("", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ledger/stats", nil)
	req.Header.Set("x-pull-key", "anything")
	h(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("unset key must reject all: code = %d, want 401", rec.Code)
	}
}

func TestConsumptionValidation(t *testing.T) {
	srv := newTestServer()
	cases := []struct {
		name string
		body string
		want int
	}{
		{"bad json", `{`, http.StatusBadRequest},
		{"bad kind", `{"grantId":1,"kind":"nope","consumedDelta":"1","contributedDelta":"1"}`, http.StatusBadRequest},
		{"bad delta", `{"grantId":1,"kind":"grant","consumedDelta":"abc","contributedDelta":"1"}`, http.StatusBadRequest},
		{"ok", `{"grantId":1,"kind":"grant","userId":1,"contributorId":2,"consumedDelta":"100","contributedDelta":"100"}`, http.StatusOK},
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/ledger/consumption", strings.NewReader(c.body))
		srv.handleConsumption(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: code = %d, want %d", c.name, rec.Code, c.want)
		}
	}
}

func TestConsumptionEnqueuesAndApplies(t *testing.T) {
	srv := newTestServer()
	body := `{"grantId":5,"kind":"grant","userId":1,"contributorId":2,"consumedDelta":"250","contributedDelta":"250"}`
	rec := httptest.NewRecorder()
	srv.handleConsumption(rec, httptest.NewRequest(http.MethodPost, "/ledger/consumption", strings.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rec.Code)
	}
	srv.drain()
	if got := srv.store.users[1].consumed.String(); got != "250" {
		t.Errorf("consumed = %s, want 250", got)
	}
}

func TestCanConsumeRequiresParams(t *testing.T) {
	srv := newTestServer()
	rec := httptest.NewRecorder()
	srv.handleCanConsume(rec, httptest.NewRequest(http.MethodGet, "/ledger/can-consume?userId=1", nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("missing contributionId: code = %d, want 400", rec.Code)
	}
}

func TestCanConsumeVerdictJSON(t *testing.T) {
	srv := newTestServer()
	srv.store.seed(&ledgerSnapshot{Users: []snapUser{
		{ID: 1, Contributed: "50", Consumed: "100", CanDownload: false, PolicyState: policyLeechDisable},
	}})
	rec := httptest.NewRecorder()
	srv.handleCanConsume(rec, httptest.NewRequest(http.MethodGet, "/ledger/can-consume?userId=1&contributionId=9", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rec.Code)
	}
	var v canConsumeVerdict
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if v.Allow || v.Reason != policyLeechDisable || v.CurrentRatio != 0.5 {
		t.Errorf("verdict = %+v, want allow=false reason=LEECH_DISABLED ratio=0.5", v)
	}
}
