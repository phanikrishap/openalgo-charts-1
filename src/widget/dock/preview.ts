/**
 * Drop preview indicator.
 *
 * Renders a semi-transparent blueprint ghost overlay that snaps smoothly
 * to the drop target zone with quick 100ms hardware-accelerated CSS transitions.
 */

export class DockPreviewOverlay {
  private readonly _el: HTMLElement;
  private _visible = false;

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument ?? (typeof document !== 'undefined' ? document : (globalThis as unknown as { document: Document }).document);
    this._el = doc.createElement('div');
    this._el.className = 'oac-dock-preview';
    this._el.style.position = 'absolute';
    this._el.style.pointerEvents = 'none';
    this._el.style.display = 'none';
    this._el.style.zIndex = '9999';
    this._el.style.boxSizing = 'border-box';
    this._el.style.transition = 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)';
    parent.appendChild(this._el);
  }

  public show(rect: { left: number; top: number; width: number; height: number }): void {
    this._el.style.display = 'block';
    this._el.style.left = `${Math.round(rect.left)}px`;
    this._el.style.top = `${Math.round(rect.top)}px`;
    this._el.style.width = `${Math.max(10, Math.round(rect.width))}px`;
    this._el.style.height = `${Math.max(10, Math.round(rect.height))}px`;
    this._visible = true;
  }

  public hide(): void {
    if (!this._visible) return;
    this._el.style.display = 'none';
    this._visible = false;
  }

  public destroy(): void {
    if (this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
  }
}
