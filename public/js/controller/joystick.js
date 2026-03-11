// Touch joystick — canvas-based virtual joystick

export class Joystick {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChange;
    this.dx = 0;
    this.dy = 0;
    this.active = false;
    this.touchId = null;

    // Joystick position
    this.centerX = 0;
    this.centerY = 0;
    this.stickX = 0;
    this.stickY = 0;
    this.baseRadius = 60;
    this.stickRadius = 30;
    this.maxDist = 50;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Touch events
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });

    // Mouse fallback for desktop testing
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup', () => this._onMouseUp());

    this._draw();
  }

  resize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.stickX = this.centerX;
    this.stickY = this.centerY;
    this._draw();
  }

  _onTouchStart(e) {
    e.preventDefault();
    if (this.touchId !== null) return;
    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    this._setCenter(touch.clientX, touch.clientY);
  }

  _onTouchMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchId) {
        this._moveStick(touch.clientX, touch.clientY);
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.touchId) {
        this.touchId = null;
        this._release();
      }
    }
  }

  _onMouseDown(e) {
    this.active = true;
    this._setCenter(e.clientX, e.clientY);
  }

  _onMouseMove(e) {
    if (this.active) this._moveStick(e.clientX, e.clientY);
  }

  _onMouseUp() {
    this.active = false;
    this._release();
  }

  _setCenter(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.centerX = clientX - rect.left;
    this.centerY = clientY - rect.top;
    this.stickX = this.centerX;
    this.stickY = this.centerY;
    this.active = true;
    this._draw();
  }

  _moveStick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > this.maxDist) {
      this.stickX = this.centerX + (dx / dist) * this.maxDist;
      this.stickY = this.centerY + (dy / dist) * this.maxDist;
    } else {
      this.stickX = x;
      this.stickY = y;
    }

    this.dx = (this.stickX - this.centerX) / this.maxDist;
    this.dy = (this.stickY - this.centerY) / this.maxDist;

    // Dead zone
    const mag = Math.hypot(this.dx, this.dy);
    if (mag < 0.15) {
      this.dx = 0;
      this.dy = 0;
    }

    this.onChange(this.dx, this.dy);
    this._draw();
  }

  _release() {
    this.stickX = this.centerX;
    this.stickY = this.centerY;
    this.dx = 0;
    this.dy = 0;
    this.onChange(0, 0);
    this._draw();
  }

  _draw() {
    const { ctx, canvas, centerX, centerY, stickX, stickY, baseRadius, stickRadius } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Base circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stick
    ctx.beginPath();
    ctx.arc(stickX, stickY, stickRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.active ? 'rgba(0,255,136,0.5)' : 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = this.active ? 'rgba(0,255,136,0.8)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
