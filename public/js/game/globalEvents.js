// Global events — random chaos mid-sprint
const EVENTS = [
  { id: 'reorg', name: 'REORG', desc: 'One random engineer has been let go', weight: 15 },
  { id: 'new_teams', name: 'NEW TEAMS', desc: '20% of enemies just got promoted', weight: 25 },
  { id: 'we_need_ai', name: 'WE NEED AI', desc: '10 AI-powered enemies have entered the chat', weight: 35 },
  { id: 'micromanager', name: 'MICROMANAGER', desc: '2 random upgrades have been downgraded', weight: 20 },
  { id: 'stakeholders', name: 'STAKEHOLDERS', desc: 'Each engineer lost a weapon', weight: 20 },
];

const TOTAL_WEIGHT = EVENTS.reduce((sum, e) => sum + e.weight, 0);

function pickWeightedEvent() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const event of EVENTS) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return EVENTS[EVENTS.length - 1];
}

export { EVENTS };

export class GlobalEventManager {
  constructor() {
    this.activeAnnouncement = null; // { name, desc, timer }
    this.upgradeHistory = [];
    this.pauseActive = false;
    this.pauseTimer = 0;
    this.pendingEvent = null; // event to execute when pause ends
  }

  // Called mid-sprint — picks event, starts 3s pause
  trigger() {
    const event = pickWeightedEvent();
    this.activeAnnouncement = { name: event.name, desc: event.desc, timer: 3 };
    this.pauseActive = true;
    this.pauseTimer = 3;
    this.pendingEvent = event;
    return event;
  }

  // Called every frame — counts down pause and announcement
  update(dt) {
    if (this.pauseActive) {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) {
        this.pauseActive = false;
      }
    }

    if (this.activeAnnouncement) {
      this.activeAnnouncement.timer -= dt;
      if (this.activeAnnouncement.timer <= 0) {
        this.activeAnnouncement = null;
      }
    }
  }

  // Called when pause ends — returns and clears the pending event
  consumePendingEvent() {
    const event = this.pendingEvent;
    this.pendingEvent = null;
    return event;
  }

  getAnnouncement() {
    return this.activeAnnouncement;
  }

  recordUpgrade(id) {
    this.upgradeHistory.push(id);
  }

  reset() {
    this.activeAnnouncement = null;
    this.upgradeHistory = [];
    this.pauseActive = false;
    this.pauseTimer = 0;
    this.pendingEvent = null;
  }
}
