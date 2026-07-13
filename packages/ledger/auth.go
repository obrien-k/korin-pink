package main

import (
	"crypto/subtle"
	"net/http"
)

// requirePullKey fronts the stellar → korin routes with the ADR-0013 shared secret
// (x-pull-key == STELLAR_PULL_KEY). Fails CLOSED when the key is unset — an
// unconfigured service rejects every caller rather than serving the gate open.
// Constant-time compare; mismatched lengths compare false without early-out.
func requirePullKey(key string, next http.HandlerFunc) http.HandlerFunc {
	want := []byte(key)
	return func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("x-pull-key"))
		if key == "" || subtle.ConstantTimeCompare(got, want) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}
