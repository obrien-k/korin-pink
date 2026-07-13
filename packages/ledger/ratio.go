package main

import "math/big"

// Ratio math, ported from stellar-api `src/modules/ratio.ts` so korin's gate
// mirrors the system of record. korin computes these for the can-consume verdict's
// informational fields; the allow decision itself rides `canDownload` (see
// handleCanConsume), not these numbers.

// giB is 1024^3, the bracket unit.
var giB = new(big.Int).Lsh(big.NewInt(1), 30)

type bracket struct {
	upTo        *big.Int // nil = unbounded (last bracket)
	maxRequired float64
	minRequired float64
	label       string
}

// brackets mirrors ratio.ts BRACKETS exactly (consumed-bytes → required ratio).
var brackets = func() []bracket {
	g := func(n int64) *big.Int { return new(big.Int).Mul(big.NewInt(n), giB) }
	return []bracket{
		{g(5), 0.0, 0.0, "0–5 GiB"},
		{g(10), 0.15, 0.0, "5–10 GiB"},
		{g(20), 0.2, 0.0, "10–20 GiB"},
		{g(30), 0.3, 0.05, "20–30 GiB"},
		{g(40), 0.4, 0.1, "30–40 GiB"},
		{g(50), 0.5, 0.2, "40–50 GiB"},
		{g(60), 0.6, 0.3, "50–60 GiB"},
		{g(80), 0.6, 0.4, "60–80 GiB"},
		{g(100), 0.6, 0.5, "80–100 GiB"},
		{nil, 0.6, 0.6, "100+ GiB"},
	}
}()

// bigToFloat mirrors JS `Number(bigint)`: a correctly-rounded float64, lossy for
// values beyond 2^53 exactly as stellar's Number() conversion is.
func bigToFloat(x *big.Int) float64 {
	f, _ := new(big.Float).SetInt(x).Float64()
	return f
}

// computeRatio is ratio.ts computeRatio: consumed==0 ⇒ 1.0, else contributed/consumed.
func computeRatio(contributed, consumed *big.Int) float64 {
	if consumed.Sign() == 0 {
		return 1.0
	}
	return bigToFloat(contributed) / bigToFloat(consumed)
}

func getConsumptionBracket(consumed *big.Int) bracket {
	for _, b := range brackets {
		if b.upTo == nil || consumed.Cmp(b.upTo) < 0 {
			return b
		}
	}
	return brackets[len(brackets)-1] // unreachable; last bracket is unbounded
}

// computeRequiredRatio is ratio.ts computeRequiredRatio.
//
// Known approximation vs. stellar: `eligible` here is the sum of a user's
// approvedAccountingBytes over links with linkStatus != FAIL — the snapshot omits
// contribution createdAt, so korin cannot apply stellar's 72h eligibility window.
// The field is informational (stellar keeps its own read-time truth); it does not
// gate.
func computeRequiredRatio(consumed, eligible *big.Int) float64 {
	b := getConsumptionBracket(consumed)
	if b.maxRequired == 0 {
		return 0
	}
	coverage := 1.0
	if consumed.Sign() != 0 {
		coverage = bigToFloat(eligible) / bigToFloat(consumed)
		if coverage > 1 {
			coverage = 1
		}
	}
	req := b.maxRequired * (1 - coverage)
	if req < b.minRequired {
		return b.minRequired
	}
	return req
}
