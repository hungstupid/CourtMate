# ADR-001: Layered client-server with a modular backend

## Status

Proposed

## Context

CourtMate has a responsive Player/Owner UI and related scheduling, booking, room and offer rules. A four-member team needs a design it can implement and maintain within the course. Cross-domain consistency and NFR-01/NFR-05 matter more than independent service scaling at this stage.

## Decision

Use React/TypeScript/Vite for presentation, one FastAPI deployment for the REST boundary and domain modules, and SQLAlchemy for persistence. Keep Identity, Courts, Bookings, Rooms and Offers responsibilities explicit. Use synchronous in-process service calls and a single application database. Vercel serves assets, Render runs the API and Neon hosts PostgreSQL (Figures 3.3–3.5).

## Alternatives considered

A server-rendered application could satisfy the requirements with less client build tooling, but would change the chosen UI stack and interaction implementation. Microservices allow independent deployment/scaling but introduce network failures, distributed consistency and additional operations. The team retains its agreed SPA/API stack and modular monolith.

## Consequences

Benefits: one local transaction across related rules, clear modules and straightforward deployment. Costs: coupled backend releases, separate SPA/API configuration and shared backend capacity. Keep transaction lifetimes short and avoid cyclic service orchestration. Revisit service extraction only when measurements or team ownership justify it.

## Traceability

NFR-01/05; FR-006–018/025/031–038/046; UC-03–05/09/11–14/17; Sections 4.2 and 5.

## Evaluation

Review route/service/entity responsibilities against Figures 3.3–3.4, then measure the PA2 workload and responsive/accessibility criteria. The design itself is not a performance test result.

