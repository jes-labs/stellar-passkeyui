# @passkey-ui/compat

The passkey compatibility matrix as structured data, plus the generators that turn it into the published guide and the SDK's runtime fallback rules.

This package is the spine of the project. The same dataset has two consumers — the human-readable guide and the code's fallback logic — so the guidance a wallet team reads and the behavior the SDK actually takes cannot drift apart.

## The dataset

Each finding records where a passkey flow works or breaks across browsers, operating systems, authenticators, and embedding contexts, why, the recommended fallback, its sources, and a verification status with a date.

Verification is kept honest:

- **documented** — sourced from specifications, vendor documentation, or issue trackers, and not yet re-confirmed on real hardware.
- **automated** — exercised by the virtual-authenticator harness in CI.
- **manual-device** — confirmed by hand on a named real device.

The shipped data is all `documented`. Moving entries to `automated` and `manual-device` is the ongoing maintenance work.

## Generating

```bash
pnpm --filter @passkey-ui/compat generate
```

This validates the dataset and writes two artifacts:

- `packages/core/src/generated/compat-rules.gen.ts` — the runtime rules the SDK consumes.
- `apps/docs/compatibility.md` — the human-readable guide, published through the docs site.

Generation is deterministic: the same data produces byte-identical output, so the committed artifacts only change when the data changes.

## Adding a finding

Edit `src/data/findings.ts`, then regenerate. Validation enforces unique ids, required fields, and ISO dates. A finding that the SDK can act on at runtime carries a `runtime` block mapping a detectable condition to a fallback action; the core package defines how each condition is detected.

## License

Apache-2.0.
