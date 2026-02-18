import { makeId } from "../utils/id";
import { parseIntensity } from "../utils/workout";
import type { Program, WorkoutData } from "./types";

const createProgram = (id: string, name: string, daysPerWeek: number): Program => ({
  id,
  name,
  daysPerWeek,
  deloadEveryWeeks: 4,
  days: Array.from({ length: daysPerWeek }, (_, index) => ({
    id: makeId("day"),
    name: `Day ${index + 1}`,
    entries: [],
  })),
});

export const createEmptyData = (): WorkoutData => ({
  version: 1,
  equipment: [],
  exercises: [],
  programs: [],
  logs: [],
});

export const createSeedData = (): WorkoutData => {
  const ringsId = makeId("eq");
  const vestId = makeId("eq");
  const pullupId = makeId("eq");
  const dumbbellId = makeId("eq");

  const ringDipId = makeId("ex");
  const chinupId = makeId("ex");
  const bulgarianId = makeId("ex");

  const homeProgram = createProgram(makeId("pg"), "Home Program", 4);
  const gymProgram = createProgram(makeId("pg"), "Gym Program", 4);

  homeProgram.days[0].entries.push({
    id: makeId("entry"),
    letter: "A1",
    supersetTag: "A",
    exerciseId: ringDipId,
    overrides: {
      intensity: parseIntensity("rings:5 | vest:4 iron"),
    },
  });

  homeProgram.days[1].entries.push({
    id: makeId("entry"),
    letter: "A1",
    supersetTag: "",
    exerciseId: chinupId,
    overrides: {
      intensity: parseIntensity("grip:regular | vest:1 iron"),
    },
  });

  gymProgram.days[0].entries.push({
    id: makeId("entry"),
    letter: "A1",
    supersetTag: "A",
    exerciseId: ringDipId,
    overrides: {
      intensity: parseIntensity("rings:7 | vest:5kg"),
    },
  });

  gymProgram.days[2].entries.push({
    id: makeId("entry"),
    letter: "B1",
    supersetTag: "",
    exerciseId: bulgarianId,
    overrides: {
      intensity: parseIntensity("load:20kg | iron:2"),
    },
  });

  return {
    version: 1,
    equipment: [
      { id: ringsId, name: "Rings", aliases: [] },
      { id: vestId, name: "Weighted Vest", aliases: ["Vest"] },
      { id: pullupId, name: "Pull-up Bar", aliases: ["Pullup Bar", "Chin Bar"] },
      { id: dumbbellId, name: "Dumbbells", aliases: ["DB"] },
    ],
    exercises: [
      {
        id: ringDipId,
        name: "Ring Dip",
        equipmentIds: [ringsId, vestId],
        goalSets: "4",
        goalReps: "6/8",
        currentSets: "4",
        currentReps: "6",
        intensity: parseIntensity("rings:5 | vest:4 iron"),
        tempo: "30X1",
        rest: "1:30",
        videoUrl: "",
      },
      {
        id: chinupId,
        name: "Chinup",
        equipmentIds: [pullupId, vestId],
        goalSets: "5",
        goalReps: "5",
        currentSets: "5",
        currentReps: "5",
        intensity: parseIntensity("grip:regular | vest:1 iron"),
        tempo: "30X2",
        rest: "3:00",
        videoUrl: "",
      },
      {
        id: bulgarianId,
        name: "Bulgarian Split Squat",
        equipmentIds: [dumbbellId],
        goalSets: "4",
        goalReps: "6/10",
        currentSets: "4",
        currentReps: "6",
        intensity: parseIntensity("load:20kg"),
        tempo: "30X1",
        rest: "1:00",
        videoUrl: "",
      },
    ],
    programs: [homeProgram, gymProgram],
    logs: [],
  };
};
