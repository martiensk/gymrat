# Product Vision

GymRat is a personal, multi-device exercise app for planning workouts, executing them with minimal friction, and seeing strength progress over time. It must remain useful offline and synchronize through Appwrite when connectivity returns.

This document describes long-term product direction. It is context for product and architecture decisions, not an implementation plan; only build features that are explicitly requested.

## Product Principles

- Logging during a workout must be fast, obvious, and resilient to lost connectivity.
- SQLite is the local source of truth; network availability must never block workout setup or execution.
- Exercise performance belongs to the exercise history, not only to one plan, so useful values and personal records carry across plans and workouts.
- Plan prescriptions and actual performance are separate. Recent performance may prefill or suggest session values but must not silently rewrite plan targets.
- A workout should guide the user through the expected sequence while allowing exercises to be completed in any order.
- The initial product is for one person, with eventual sign-in and Appwrite sync across that person's devices rather than social or shared-workout features.

## Equipment

Users maintain a reusable equipment list. Each equipment item has:

- Name
- Optional thumbnail
- One or more measurable axes, each with a label, optional unit, and numeric step/increment

Multiple axes allow an exercise to track more than one form of intensity. For example, a ring row may record ring height and weighted-vest load. Units may include kg, lb, time, height, or another equipment-appropriate measurement.

## Exercises

Users maintain a reusable exercise library. Each exercise has:

- Name
- Optional thumbnail
- Muscle or muscle group
- Optional YouTube video link
- Default equipment, including any applicable measurement axes
- Default rest time in minutes
- Default tempo such as `30X1`
- Default target sets and reps
- Rep mode: counted repetitions or elapsed time for static holds

Exercise defaults seed new plan entries; changing values while configuring a plan or performing a workout does not overwrite those defaults.

Each exercise owns its performance history across every plan and workout. The app retains:

- Most recent completed performance, used to suggest values in future sessions
- Highest repetition or duration achievements
- Highest intensity achievements across the exercise's configured equipment measurements
- Enough historical set data to show progression over time

Personal records and recent values persist independently of plan changes. Where an exercise has multiple intensity measurements, each set must retain all applicable values.

## Workout Plans

Users can create and edit workout plans at any time. A plan has:

- Name
- Active status; no more than one plan may be active
- One to seven training days, defaulting to four
- A training split, defaulting to push/pull/legs, with other common splits available
- An intensity goal such as one rep in reserve or failure
- An optional repeating deload week from 2 to 52; week 5 represents four normal plan cycles followed by one deload cycle

Plan exercises are configured per training day and selected from the exercise library. Exercise defaults seed the initial configuration, while plan-specific sets, reps or duration, rest time, tempo, equipment, and intensity targets are persisted on the plan.

Plan exercises can be reordered by dragging. Exercises can also be linked into a superset. A superset behaves as one unit when selecting the next exercise and has one rest period after all linked exercises have been performed for the set.

A plan may define optional warm-up and cooldown checklists that apply to each training day.

The deload schedule is plan metadata until deload execution is implemented. Saving the schedule does not currently alter prescriptions or workout progression.

## Starting A Workout

The start screen centers on a prominent action that starts the next training day in the active plan. Before starting, the user may:

- Override the proposed training day for this session

Starting creates a session from the selected plan day. The session preserves its own targets and results so later plan edits do not rewrite history. Recent exercise performance should be suggested for the session without changing the underlying plan prescription.

## Workout Overview

An active workout shows every exercise or superset for the selected day. The user may select any unfinished item and complete the workout out of order.

A prominent **Next** action starts the next unfinished item in plan order. A superset counts as one item for this purpose.

## Exercise Flow

For the current set, the exercise screen shows:

- Exercise details
- The last completed repetition count, duration, and intensity values for that set position when available
- Inputs for the current repetitions or duration and all applicable intensity values
- **Next** and **Skip** actions

**Next** remains disabled until the required repetition or duration input is complete. Completing a set records its performance. Skipping records no performance for that set.

Normal flow is:

`exercise -> rest -> next set or exercise`

Superset flow is:

`exercise 1 -> exercise 2 -> ... -> shared rest -> next superset set`

The latest completed exercise performance should be available as the suggestion for subsequent workouts, including another currently active session where applicable, while its prescribed plan target remains unchanged.

## Rest Timer

The rest screen shows the countdown and a **Skip** action. It advances automatically at zero. Skipping advances immediately. After rest, the app returns to the next set or next required exercise according to the normal or superset flow.

## Analytics

Analytics should make strength and performance increases visible over time. At minimum, users should be able to inspect exercise-level trends based on recorded repetitions or duration and equipment intensity measurements. Analytics must derive from immutable workout history rather than mutable plan targets.

## Decisions To Make When Relevant

These details are intentionally unresolved and should be clarified before implementing the affected feature:

- How split selection names or automatically populates plan days
- How a plan advances its "next day" after completed, skipped, partial, or abandoned sessions
- How personal records compare performances with multiple intensity axes
- Whether warm-up and cooldown checklist completion is retained in workout history
- The exact account sign-in and anonymous-data upgrade flow for multi-device sync
