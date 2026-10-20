import { neutralInput, type Input } from './core/game.ts';

export class Controls {
  private keys = new Set<string>();
  private touch = new Set<string>();
  enabled = false;
  onPause = () => {};
  constructor() {
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
        return;
      if (event.code === 'Escape') {
        this.onPause();
        return;
      }
      if (!this.enabled) return;
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code))
        event.preventDefault();
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
    document.addEventListener('pointerdown', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-control]');
      if (!button || !this.enabled) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      this.touch.add(button.dataset.control!);
      button.classList.add('pressed');
    });
    const release = (event: PointerEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-control]');
      if (button) {
        this.touch.delete(button.dataset.control!);
        button.classList.remove('pressed');
      }
    };
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
  }
  clear() {
    this.keys.clear();
    this.touch.clear();
    document.querySelectorAll('.pressed').forEach(e => e.classList.remove('pressed'));
  }
  read(): Input {
    if (!this.enabled) return neutralInput();
    const down = (...keys: string[]) => keys.some(k => this.keys.has(k) || this.touch.has(k));
    let steer =
      (down('ArrowRight', 'KeyD', 'right') ? 1 : 0) - (down('ArrowLeft', 'KeyA', 'left') ? 1 : 0);
    const input: Input = {
      steer,
      jump: down('Space', 'jump'),
      spin: down('KeyX', 'spin'),
      grab: down('KeyZ', 'grab'),
      flip: down('KeyC', 'flip'),
    };
    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if (pad) {
      if (Math.abs(pad.axes[0]) > 0.15) steer = pad.axes[0];
      input.steer = steer;
      input.jump ||= pad.buttons[0]?.pressed;
      input.spin ||= pad.buttons[2]?.pressed;
      input.grab ||= pad.buttons[1]?.pressed;
      input.flip ||= pad.buttons[3]?.pressed;
    }
    return input;
  }
}
