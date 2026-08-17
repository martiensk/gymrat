# Implementation Roadmap

This roadmap tracks the major work remaining against `docs/vision.md`. Items are ordered roughly by dependency and recommended implementation sequence.

## Core Workout

1. Replace the flat workout scaffold with session, exercise, set, measurement, and checklist-result models.
2. Build the Home/start-workout screen.
3. Select or propose the next training day.
4. Snapshot plan prescriptions when starting a session.
5. Build the active workout overview.
6. Allow exercises and supersets to be completed out of order.
7. Build per-set exercise execution for repetitions and timed holds.
8. Record all equipment measurement axes per set.
9. Implement Next, Skip, completion, partial-workout, and abandonment flows.
10. Persist active sessions so they survive app restarts.
11. Implement normal and superset progression state machines.
12. Build the rest timer with automatic and manual skipping.
13. Advance the active plan's next training day after workouts.

## Deload

14. Track completed plan cycles.
15. Detect scheduled deload cycles.
16. Define and apply deload prescription adjustments.
17. Resume normal scheduling after each deload.

## History And Analytics

18. Store immutable workout and individual-set history.
19. Show recent performance suggestions by exercise and set position.
20. Track repetition, duration, and equipment-intensity personal records.
21. Display exercise history instead of the current placeholder.
22. Build exercise progression charts and analytics.

## Checklist Execution

23. Snapshot warm-up and cooldown checklists into sessions.
24. Make checklist items actionable during workouts.
25. Decide whether checklist completion belongs in workout history.

## Plan Improvements

26. Allow plan entries to add, replace, remove, and reorder equipment independently of exercise defaults.
27. Decide whether split selection names or automatically populates training days.

## Accounts And Sync

28. Build sign-in, sign-out, account recovery, and account-state UI.
29. Define anonymous-data upgrade behavior.
30. Partition local data and sync cursors by account.
31. Replace the flat Appwrite workout schema with the future session aggregate.
32. Harden handling of malformed remote documents and sync cursors.

## Media

33. Add Appwrite Storage upload, download, caching, deletion, and retry handling for thumbnails.
34. Display synchronized thumbnails across devices.

## Cleanup

35. Remove legacy SQLite repair migrations and legacy sync payload parsing per `AGENTS.md`.
36. Remove or replace the obsolete flat `workouts` model.
37. Update stale README references, including custom plan locations.
38. Enforce that equipment has at least one measurement axis if that vision requirement remains desired.
