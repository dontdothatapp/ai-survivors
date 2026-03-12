// Global events — predefined per sprint
const EVENTS = [
  { id: 'new_teams', name: 'RANDOM PROMOTIONS', desc: '20% of enemies just got promoted' },
  { id: 'we_need_ai', name: 'WE NEED AI', desc: '10 AI-powered enemies have entered the chat' },
  { id: 'aleksei', name: 'ALEKSEI', desc: 'A friendly face has appeared to help!' },
  { id: 'micromanager', name: 'MICROMANAGER', desc: '2 random upgrades have been downgraded' },
  { id: 'feedback', name: 'FEEDBACK', desc: '10 jira tickets are flying your way!' },
  { id: 'reorg', name: 'REORG', desc: '25% of engineers have been let go' },
];

const SPRINT_EVENT_MAP = {
  1: 'new_teams',
  2: 'we_need_ai',
  3: 'aleksei',
  4: 'micromanager',
  5: 'feedback',
  6: 'reorg',
};

export { EVENTS, SPRINT_EVENT_MAP };

export class GlobalEventManager {
  constructor() {
    this.activeAnnouncement = null; // { name, desc, timer }
    this.upgradeHistory = [];
    this.pauseActive = false;
    this.pauseTimer = 0;
    this.pendingEvent = null; // event to execute when pause ends
  }

  // Called mid-sprint — looks up event for the given wave, starts 3s pause
  trigger(waveNumber) {
    const eventId = SPRINT_EVENT_MAP[waveNumber];
    if (!eventId) return null;
    const event = EVENTS.find(e => e.id === eventId);
    if (!event) return null;
    this.activeAnnouncement = { name: event.name, desc: event.desc, id: event.id, timer: 3 };
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
