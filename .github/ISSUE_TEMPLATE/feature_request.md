---
name: Feature request
about: Propose a change to the SDK
labels: enhancement
---

## Problem

<!-- What can't you do today? Why does it matter? -->

## Proposed change

<!-- What would the API look like? Code example preferred. -->

```ts
// before
const client = wrap(new Anthropic(), { apiKey, route: "x" });

// after
const client = wrap(new Anthropic(), { apiKey, route: "x", newOption: true });
```

## Alternatives considered

<!-- Other approaches you thought about and why this one is better. -->

## Out of scope

<!-- Things you do NOT want this proposal to cover. -->
