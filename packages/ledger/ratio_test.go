package main

import (
	"math/big"
	"testing"
)

func bi(n int64) *big.Int { return big.NewInt(n) }

// gib returns n GiB as a *big.Int.
func gib(n int64) *big.Int { return new(big.Int).Mul(big.NewInt(n), giB) }

func TestComputeRatio(t *testing.T) {
	cases := []struct {
		name        string
		contributed *big.Int
		consumed    *big.Int
		want        float64
	}{
		{"zero consumed is 1.0", bi(0), bi(0), 1.0},
		{"zero consumed ignores contributed", bi(500), bi(0), 1.0},
		{"half", bi(50), bi(100), 0.5},
		{"even", bi(100), bi(100), 1.0},
	}
	for _, c := range cases {
		if got := computeRatio(c.contributed, c.consumed); got != c.want {
			t.Errorf("%s: computeRatio=%v want %v", c.name, got, c.want)
		}
	}
}

func TestComputeRequiredRatio(t *testing.T) {
	cases := []struct {
		name     string
		consumed *big.Int
		eligible *big.Int
		want     float64
	}{
		// 0–5 GiB bracket ⇒ maxRequired 0 ⇒ always 0.
		{"under 5 GiB is free", gib(2), bi(0), 0},
		// 5–10 GiB, no coverage ⇒ maxRequired 0.15.
		{"5-10 GiB no coverage", gib(7), bi(0), 0.15},
		// 5–10 GiB, full coverage ⇒ max(min=0, 0.15*(1-1)) = 0.
		{"5-10 GiB full coverage", gib(7), gib(7), 0},
		// 100+ GiB floor is minRequired 0.6 even at full coverage.
		{"100+ GiB floor", gib(120), gib(120), 0.6},
	}
	for _, c := range cases {
		if got := computeRequiredRatio(c.consumed, c.eligible); got != c.want {
			t.Errorf("%s: computeRequiredRatio=%v want %v", c.name, got, c.want)
		}
	}
}

func TestGetConsumptionBracketLabels(t *testing.T) {
	if got := getConsumptionBracket(gib(3)).label; got != "0–5 GiB" {
		t.Errorf("3 GiB bracket = %q", got)
	}
	if got := getConsumptionBracket(gib(250)).label; got != "100+ GiB" {
		t.Errorf("250 GiB bracket = %q", got)
	}
}
