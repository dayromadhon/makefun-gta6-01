// The story: Leo Marín owes $4,500 to the loan shark Rocco Vane, and Ada Kwan, his
// dispatcher, lines up the jobs that pay it off. Five missions, then side jobs for cash
// in free roam. A mission is a chain of steps (drive somewhere, pick something up, lose
// the cops, run fares); the manager reports completions and failures as events.

const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: 'Ada: "Leo, you need wheels before anything. Grab any car on the street and bring it to my garage, south-west corner."',
    reward: 400,
    steps: [
      { type: 'enterCar', text: 'Steal a car — walk up to one and press E' },
      { type: 'goto', x: -84, z: 96, radius: 8, text: 'Drive to Ada\'s garage' },
    ],
  },
  {
    id: 'package-run',
    title: 'Package Run',
    briefing: 'Ada: "A package is waiting on the marina dock. Pick it up and take it to the Hotel Solmar — fast. The client pays for speed."',
    reward: 600,
    steps: [
      { type: 'goto', x: 214, z: 48, radius: 7, text: 'Pick up the package at the marina dock' },
      { type: 'goto', x: 84, z: -56, radius: 8, time: 100, text: 'Deliver the package to the Hotel Solmar' },
    ],
  },
  {
    id: 'lose-the-heat',
    title: 'Lose the Heat',
    briefing: 'Ada: "You got spotted, Leo. Two stars and the whole department is awake. Shake them off — get clean and meet me at the pier."',
    reward: 800,
    startWanted: 2,
    steps: [
      { type: 'escape', time: 150, text: 'Lose the cops — get your wanted level to zero' },
      { type: 'goto', x: 0, z: 196, radius: 8, text: 'Meet Ada at the south pier' },
    ],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    briefing: 'Ada: "Quiet night, loud money. Three fares, three drop-offs. Keep the meter running and the car in one piece."',
    reward: 900,
    steps: [
      { type: 'goto', x: -168, z: -20, radius: 7, text: 'Pick up fare 1 at the north-west corner' },
      { type: 'goto', x: 126, z: 84, radius: 7, text: 'Drop off fare 1 at the east market' },
      { type: 'goto', x: 42, z: -168, radius: 7, text: 'Pick up fare 2 at the north avenue' },
      { type: 'goto', x: -126, z: 126, radius: 7, text: 'Drop off fare 2 at the plaza' },
      { type: 'goto', x: 168, z: 0, radius: 7, text: 'Pick up fare 3 at the marina gate' },
      { type: 'goto', x: -42, z: -84, radius: 7, text: 'Drop off fare 3 downtown' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    briefing: 'Ada: "Last one, Leo. Rocco\'s courier van leaves the downtown bank at dawn. Take it, bring it to the hideout, and your debt is gone."',
    reward: 2000,
    startWanted: 3,
    needsVan: true,
    steps: [
      { type: 'enterCar', van: true, text: 'Steal the courier van at the downtown bank' },
      { type: 'goto', x: -168, z: -154, radius: 9, text: 'Deliver the van to the hideout — and lose the cops' },
    ],
  },
];

export function createMissions(city, random) {
  let index = 0; // next mission to start
  let active = null; // { mission, stepIndex, timeLeft }
  let sideJob = null;
  let sideJobCount = 0;

  function markerFor(step) {
    if (!step) return null;
    if (step.type === 'enterCar') return null;
    if (step.type === 'escape') return null;
    return { x: step.x, z: step.z };
  }

  // Restore the story position after loading a save (or reset it for a new game):
  // startMission() only sets the active mission, it never moves the index, so
  // without this Continue would show mission N's card but start mission 1.
  function setProgress(done) {
    index = Math.max(0, Math.min(MISSIONS.length, done | 0));
  }

  function startMission(i, events) {
    const mission = MISSIONS[i];
    active = { mission, stepIndex: 0, timeLeft: mission.steps[0].time ?? 0 };
    if (mission.startWanted && events && events.onMissionStartWanted) {
      events.onMissionStartWanted(mission.startWanted);
    }
    if (mission.needsVan && events && events.onNeedVan) events.onNeedVan();
    return active;
  }

  function startSideJob(events) {
    sideJobCount += 1;
    const pickup = city.randomRoadPoint();
    const drop = city.randomRoadPoint();
    sideJob = {
      mission: {
        id: `side-${sideJobCount}`,
        title: 'Side Job',
        briefing: 'Ada: "Quick cash, Leo. A fare needs a ride across town."',
        reward: 150 + random.int(0, 3) * 50,
      },
      stepIndex: 0,
      timeLeft: 0,
      steps: [
        { type: 'goto', x: pickup.x, z: pickup.z, radius: 7, text: 'Pick up the fare' },
        { type: 'goto', x: drop.x, z: drop.z, radius: 7, time: 90, text: 'Drop off the fare' },
      ],
    };
    active = sideJob;
    return active;
  }

  function currentStep() {
    if (!active) return null;
    return active.mission.steps[active.stepIndex] ?? null;
  }

  function objectiveText() {
    if (!active) return '';
    const step = currentStep();
    if (!step) return '';
    return `${active.mission.title}: ${step.text}`;
  }

  function update(dt, player, wanted, events) {
    if (!active) return;
    const step = currentStep();
    if (!step) return;
    if (step.time) {
      active.timeLeft -= dt;
      if (active.timeLeft <= 0) {
        const failed = active;
        active = null;
        if (events && events.onMissionFail) events.onMissionFail(failed.mission, 'Out of time');
        return;
      }
    }
    let done = false;
    if (step.type === 'enterCar') {
      done = !!player.car && (!step.van || player.car.kind === 'van');
    } else if (step.type === 'escape') {
      done = wanted.stars === 0;
    } else if (step.type === 'goto') {
      const dist = Math.hypot(player.x - step.x, player.z - step.z);
      done = dist <= step.radius;
    }
    if (!done) return;
    active.stepIndex += 1;
    if (events && events.onStepComplete) events.onStepComplete(active.mission, active.stepIndex);
    const next = currentStep();
    if (next) {
      active.timeLeft = next.time ?? 0;
      return;
    }
    // Mission complete.
    const finished = active;
    active = null;
    if (finished === sideJob) sideJob = null;
    else index = Math.min(MISSIONS.length, index + 1);
    if (events && events.onMissionComplete) events.onMissionComplete(finished.mission, finished.mission.reward);
  }

  function startNext(events) {
    if (index < MISSIONS.length) return startMission(index, events);
    return startSideJob(events);
  }

  function retry(events) {
    if (active) return active;
    // Retry the last failed mission (the index still points at it).
    return startNext(events);
  }

  return {
    missions: MISSIONS,
    get active() {
      return active;
    },
    get nextIndex() {
      return index;
    },
    get storyDone() {
      return index >= MISSIONS.length;
    },
    get marker() {
      return markerFor(currentStep());
    },
    get timeLeft() {
      return active ? active.timeLeft : 0;
    },
    get timeLimit() {
      const step = currentStep();
      return step && step.time ? step.time : 0;
    },
    objectiveText,
    update,
    startNext,
    retry,
    startMission,
    setProgress,
  };
}
