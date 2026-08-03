# Full Major Arcana Council integration

Agents Council does not own provider clients or model credentials. Hermes owns
the Tarot Router runtime and exposes the signed Major Arcana packages through
`POST /v1/occult/invoke`. Council owns the reading graph, bounded parallelism,
approval gates, durable state, and restart/resume behavior.

The Hermes starter deck contains these stable agent identifiers:

```text
occult.major.fool
occult.major.magician
occult.major.high_priestess
occult.major.empress
occult.major.emperor
occult.major.hierophant
occult.major.lovers
occult.major.chariot
occult.major.strength
occult.major.hermit
occult.major.wheel_of_fortune
occult.major.justice
occult.major.hanged_man
occult.major.death
occult.major.temperance
occult.major.devil
occult.major.tower
occult.major.star
occult.major.moon
occult.major.sun
occult.major.judgement
occult.major.world
```

The identifiers are runtime contract data, not a provider list. A Council plan
may assign different Minor Arcana routes through Hermes, but a production local
plan should set `local_only: true`, `free_only: true`, and
`maximum_cost_usd: 0` until an operator explicitly changes that policy.

## Bounded parallel execution

Council can run independent Major Arcana nodes concurrently by setting
`maximum_parallelism` between 1 and 16. Hermes separately enforces its own
provider concurrency limit. The effective concurrency is the lower of those
two bounds, so a Council reading cannot bypass a local provider's capacity.

`examples/occult/full-major-arcana.json` starts one bounded batch containing
all 22 agents, then runs a synthesis node after every result is available. It
is safe to use as a local dry run after the Hermes gateway is initialized.

## Recovery and approval

The Council state schema remains `3` and the shared Occult contract remains
`1.0.0`. Approval-required nodes pause before invoking Hermes. The state file
can be reloaded after a process restart and the same idempotent plan resumes
without repeating completed nodes. Route summaries are redacted; Council
state never contains prompts, provider responses, access tokens, or API keys.

## Authoritative onboarding

Install and initialize the local runtime using the [Tarot Router local public
v1 quickstart](https://github.com/SgtSlummy/hermes-agent/blob/main/docs/tarot-router/quickstart.md).
Do not use the upstream `agents-council@latest` package or an unverified
provider route for this integration.
