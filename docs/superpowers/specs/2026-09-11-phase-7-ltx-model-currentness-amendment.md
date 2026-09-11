# Phase 7 LTX Model Currentness Amendment

**Date:** 2026-09-11
**Applies to:** `2026-09-11-phase-7-video-generation-provider-design.md` and implementation plan

## Reason

The initial Phase 7 design described LTX-2.3 as the current production model line. Fresh LTX documentation checked during implementation shows that LTX-2.5 is now the newest supported generation family while LTX-2.3 remains supported.

## Corrected production decision

- Keep the provider-neutral domain unchanged.
- Use the async V2 endpoint `https://api.ltx.io/v2/text-to-video`.
- Default current-quality profile: `ltx-2-5-pro`.
- Default output profile remains 1080p, 24 fps, silent provider output (`generate_audio: false`).
- Fixed shot durations remain 6, 8, or 10 seconds for the Pro profile.
- Only 16:9 and 9:16 are allowed for direct text-to-video generation in Phase 7.
- Existing provider-neutral planned duration is normalized to the nearest supported 6/8/10-second slot inside a 4–12 second planning envelope; ties round upward.
- Known camera-intent aliases are normalized to LTX camera motion enum values; unrecognized free-form camera intent remains in the master prompt and is omitted from the provider enum field.
- LTX-2.3 model IDs remain eligible for a future explicit cost-optimized profile because LTX still supports them, but they are not the default and are not described as the current model line.
- Removed LTX-2 (`ltx-2-fast`, `ltx-2-pro`) IDs remain forbidden.

## API lifecycle

The status flow remains provider-neutral outside the adapter:

`pending -> QUEUED`
`processing -> PROCESSING`
`completed -> COMPLETED`
`failed -> FAILED`

The provider job is polled at `GET /v2/text-to-video/{id}`. Terminal job metadata/output URLs are ephemeral and must be imported to PAK-owned storage immediately; they are not durable media identity.

## Security

This amendment does not change the security boundary: the LTX API key is read only in the Supabase Edge execution path from Integration Vault and never enters browser or Next.js provider execution state.
