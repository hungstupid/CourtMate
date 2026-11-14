# ADR-003: Firebase identity with backend role and ownership checks

## Status

Proposed

## Context

Visitors can read public information, while protected actions require a valid identity, exactly one application role and ownership of the relevant resource. Organizer permission is derived from a room’s source booking. Untrusted browser state must not grant access.

## Decision

Delegate credentials and ID-token issuance to Firebase Authentication. The browser sends a Bearer token; the backend verifies it with the Firebase Admin SDK, including configured revocation/account-state checks, and resolves firebase_uid to the application User. Store the Player/Court Owner role in PostgreSQL, establish it only through valid initial registration, and reject later client attempts to change it. Enforce owner_id, player_id and organizer_id in protected operations and authorize response data.

## Alternatives considered

Custom password authentication would add credential storage, password reset and session security work. Client-only route guards are bypassable. Firebase custom claims could carry authorization information, but introduce refresh/propagation concerns; they are not the authority for CourtMate resource ownership. The local user record keeps role and ownership checks aligned with application data.

## Consequences

CourtMate does not store password hashes or persist bearer tokens in application tables; Firebase manages the credentials. Identity verification adds an external dependency and token refresh handling. Missing/invalid/expired/revoked identities are rejected; provider-verification failures fail closed. Use HTTPS, validate allowed origins, keep Admin credentials server-side and avoid token/secret logging. UI visibility is only a usability aid, not an access-control boundary.

## Traceability

NFR-04; FR-001–005/030/037/039–040; BR-09; UC-01/02/05–10/12–17; IdentityAPI / Auth in Section 4.2.

## Evaluation

Test absent/expired/forged tokens, both valid initial roles, post-registration role tampering, Player-to-Owner access, cross-Owner resources, another Player’s booking and non-organizer closure. Denied reads must expose no protected data; denied writes must change no protected state.

