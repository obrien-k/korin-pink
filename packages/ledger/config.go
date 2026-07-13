package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"
)

type config struct {
	port            string
	refreshInterval time.Duration // snapshot re-pull cadence (bridges deferred /ledger/sync)
	stellarURL      string        // STELLAR_API_URL — base for the snapshot pull
	stellarKey      string        // STELLAR_API_KEY — Bearer for korin → stellar (snapshot)
	stellarPullKey  string        // STELLAR_PULL_KEY — expected x-pull-key for stellar → korin
}

func loadConfig() config {
	return config{
		port:            env("LEDGER_PORT", "3001"),
		refreshInterval: time.Duration(envInt("LEDGER_REFRESH_INTERVAL_MS", 60000)) * time.Millisecond,
		stellarURL:      os.Getenv("STELLAR_API_URL"),
		stellarKey:      os.Getenv("STELLAR_API_KEY"),
		stellarPullKey:  os.Getenv("STELLAR_PULL_KEY"),
	}
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
