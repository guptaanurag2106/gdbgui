/*
this assumes that the data.x is increasing, data.y can be anything
*/
import React from "react";
import { store } from "statorgfc";

type Point = [number, number];

type Props = {
  data: Point[];
  data_version?: number;
  minSize?: number;
  maxSize?: number;
  title?: string;
  aspectRatio?: number;
};

type State = any;

const CIRCLE_RADIUS_RATIO = 80;
const BARS = 10;
const FONT_FAMILY = "monospace";

// questionably ugly colours, replace with monokai/light classes, or direct to tailwind
const THEME_COLORS: Record<
  string,
  { bg: string; grid: string; text: string; line: string; point: string; hover: string }
> = {
  monokai: {
    bg: "#333",
    grid: "#49483e",
    text: "#f8f8f2",
    line: "#66d9ef",
    point: "#a6e22e",
    hover: "#e6db74"
  },
  light: {
    bg: "#fff",
    grid: "#ddd",
    text: "#333",
    line: "#0366d6",
    point: "#22863a",
    hover: "#e36209"
  }
};

class Graph extends React.Component<Props, State> {
  private canvas_ref = React.createRef<HTMLCanvasElement>();
  private container_ref = React.createRef<HTMLDivElement>();

  private ctx: CanvasRenderingContext2D | null = null;
  private octx: CanvasRenderingContext2D | null = null;
  private offscreen: HTMLCanvasElement | null = null;

  private resize_observer: ResizeObserver | null = null;
  private text_width_map = new Map<string, number>();
  private font_size = 0;

  private pad_x = 0;
  private pad_y = 0;
  private plot_w = 0;
  private plot_h = 0;
  private data_x_range: [number, number] = [-5, 5];
  private data_y_range: [number, number] = [-5, 5];
  private screen_coords: { sx: number; sy: number; di: number }[] = [];
  private current_view: [number, number] = [0, 0];

  private dragging = false;
  private last_x = 0;
  private internal_width = 0;
  private internal_height = 0;
  private initial_width = 0;

  static defaultProps = {
    minSize: 200,
    maxSize: 900,
    title: "",
    aspectRatio: 1.5
  };

  constructor(props: Props) {
    super(props);
    const min = props.minSize || 200;
    const max = props.maxSize || 900;
    this.initial_width = Math.floor((min + max) / 2);
    this.state = {
      width: this.initial_width,
      show_reset: false
    };
    store.connectComponentState(this, ["current_theme"]);
  }

  componentDidMount() {
    const canvas = this.canvas_ref.current;
    const container = this.container_ref.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    this.ctx = ctx;

    this.offscreen = document.createElement("canvas");
    this.octx = this.offscreen.getContext("2d");

    this.internal_width = this.initial_width;
    this.internal_height = Math.floor(
      this.internal_width / (this.props.aspectRatio || 1.5)
    );
    container.style.width = this.internal_width + "px";
    this._sync_canvas_size(this.internal_width, this.internal_height);
    this._apply_font();
    this._render_static();
    this._blit();

    this.resize_observer = new ResizeObserver(() => {
      this._on_resize();
    });
    this.resize_observer.observe(container);

    canvas.addEventListener("pointerdown", this._on_pointerdown);
    canvas.addEventListener("pointermove", this._on_pointermove);
    canvas.addEventListener("pointerup", this._on_pointerup);
    canvas.addEventListener("pointerleave", this._on_pointerleave);
    canvas.addEventListener("wheel", this._on_wheel, { passive: false });
    canvas.addEventListener("dblclick", this._on_dblclick);
  }

  componentDidUpdate(prev_props: Props, prev_state: any) {
    if (
      prev_props.data_version !== this.props.data_version ||
      prev_state.current_theme !== this.state.current_theme
    ) {
      this._apply_font();
      this._render_static();
      this._blit();
    }
  }

  componentWillUnmount() {
    this.resize_observer?.disconnect();

    const canvas = this.canvas_ref.current;
    if (canvas) {
      canvas.removeEventListener("pointerdown", this._on_pointerdown);
      canvas.removeEventListener("pointermove", this._on_pointermove);
      canvas.removeEventListener("pointerup", this._on_pointerup);
      canvas.removeEventListener("pointerleave", this._on_pointerleave);
      canvas.removeEventListener("wheel", this._on_wheel);
      canvas.removeEventListener("dblclick", this._on_dblclick);
    }
  }

  private _colors() {
    return THEME_COLORS[this.state.current_theme] || THEME_COLORS.monokai;
  }

  private _sync_canvas_size(w: number, h: number) {
    const canvas = this.canvas_ref.current;
    const offscreen = this.offscreen;
    if (!canvas || !offscreen || !this.ctx || !this.octx) return;

    canvas.width = w;
    canvas.height = h;
    offscreen.width = w;
    offscreen.height = h;
  }

  private _on_resize = () => {
    const container = this.container_ref.current;
    if (!container) return;

    const ratio = this.props.aspectRatio || 1.5;
    const min = this.props.minSize || 200;
    const max = this.props.maxSize || 900;
    let w = Math.floor(container.offsetWidth);
    w = Math.max(min, Math.min(max, w));
    const h = Math.floor(w / ratio);
    if (w === this.internal_width) return;

    this.internal_width = w;
    this.internal_height = h;
    container.style.height = h + "px";
    this._sync_canvas_size(w, h);
    this._apply_font();
    this._render_static();
    this._blit();
  };

  private _apply_font() {
    const size = Math.max(8, Math.min(this.internal_width, this.internal_height) / 65);
    this.font_size = size;
    const font_str = `${size}px ${FONT_FAMILY}`;
    if (this.ctx) this.ctx.font = font_str;
    if (this.octx) this.octx.font = font_str;
    this.text_width_map.clear();
  }

  private _measure_text(text: string): number {
    const cached = this.text_width_map.get(text);
    if (cached !== undefined) return cached;
    const w = this.octx?.measureText(text).width || 0;
    this.text_width_map.set(text, w);
    return w;
  }

  private _tick_label(val: number, step: number): string {
    const d = Math.max(0, Math.ceil(-Math.log10(step)));
    let s = val.toFixed(d);
    if (d > 0) s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }

  private _render_static(view?: [number, number]) {
    const data = this.props.data;
    const octx = this.octx;
    const w = this.internal_width;
    const h = this.internal_height;
    if (!octx || w === 0 || h === 0) return;

    if (view === undefined) {
      view = [0, Math.max(0, data.length - 1)];
      this.setState({ show_reset: false });
    }

    view[0] = Math.max(0, Math.min(view[0], data.length - 1));
    view[1] = Math.max(0, Math.min(view[1], data.length - 1));

    const max_points = Math.max(2, Math.floor(w / 10));
    if (view[1] - view[0] >= max_points) {
      view[0] = view[1] - max_points + 1;
    }
    this.current_view = view;

    octx.fillStyle = this._colors().bg;
    octx.fillRect(0, 0, w, h);

    // data ranges
    if (data.length === 0 || view[0] > view[1]) {
      this.data_x_range = [-5, 5];
      this.data_y_range = [-5, 5];
      this.current_view = [0, -1];
      this.screen_coords = [];
      this._draw_grid_and_labels(octx, w, h);
      return;
    }

    this.data_x_range = [data[view[0]][0], data[view[1]][0]];
    this.data_y_range = [Infinity, -Infinity];
    for (let i = view[0]; i <= view[1]; i++) {
      this.data_y_range[0] = Math.min(this.data_y_range[0], data[i][1]);
      this.data_y_range[1] = Math.max(this.data_y_range[1], data[i][1]);
    }

    if (this.data_x_range[0] === this.data_x_range[1]) {
      const x = this.data_x_range[0];
      this.data_x_range = x === 0 ? [-5, 5] : [Math.min(0, 2 * x), Math.max(0, 2 * x)];
    }
    if (this.data_y_range[0] === this.data_y_range[1]) {
      const y = this.data_y_range[0];
      this.data_y_range = y === 0 ? [-5, 5] : [Math.min(0, 2 * y), Math.max(0, 2 * y)];
    }

    const span_x = this.data_x_range[1] - this.data_x_range[0];
    const span_y = this.data_y_range[1] - this.data_y_range[0];
    const step_x = span_x / BARS;
    const step_y = span_y / BARS;

    // padding
    const y_min_str = this._tick_label(this.data_y_range[0], step_y);
    const y_max_str = this._tick_label(this.data_y_range[1], step_y);
    const y_min_w = this._measure_text(y_min_str);
    const y_max_w = this._measure_text(y_max_str);
    this.pad_x = Math.max(
      Math.max(y_min_w, y_max_w) + this.font_size * 0.7,
      this.font_size * 2
    );
    this.pad_y = this.font_size * 1.5;
    this.plot_w = w - this.pad_x * 2;
    this.plot_h = h - this.pad_y * 2;

    const scale_x = this.plot_w / span_x;
    const scale_y = this.plot_h / span_y;

    // screen coords
    this.screen_coords = new Array(view[1] - view[0] + 1);
    for (let i = view[0]; i <= view[1]; i++) {
      this.screen_coords[i - view[0]] = {
        sx: this.pad_x + (data[i][0] - this.data_x_range[0]) * scale_x,
        sy: h - this.pad_y - (data[i][1] - this.data_y_range[0]) * scale_y,
        di: i
      };
    }

    this._draw_grid_and_labels(octx, w, h, step_x, step_y, scale_x, scale_y);

    // line segments
    if (this.screen_coords.length > 1) {
      octx.strokeStyle = this._colors().line;
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(this.screen_coords[0].sx, this.screen_coords[0].sy);
      for (let i = 1; i < this.screen_coords.length; i++) {
        octx.lineTo(this.screen_coords[i].sx, this.screen_coords[i].sy);
      }
      octx.stroke();
    }

    // points
    const r = Math.min(w, h) / CIRCLE_RADIUS_RATIO;
    octx.fillStyle = this._colors().point;
    octx.beginPath();
    for (let i = 0; i < this.screen_coords.length; i++) {
      const { sx, sy } = this.screen_coords[i];
      octx.moveTo(sx + r, sy);
      octx.arc(sx, sy, r, 0, Math.PI * 2);
    }
    octx.fill();

    // overflow arrows
    const arrow_size = this.font_size * 1.4;
    const gap = this.font_size * 0.35;
    octx.font = `${arrow_size}px ${FONT_FAMILY}`;
    if (view[1] !== data.length - 1) {
      octx.fillStyle = "red";
      octx.textAlign = "left";
      octx.textBaseline = "top";
      octx.fillText("\u2192", w - this.pad_x / 2, h - this.pad_y + gap);
    }
    if (view[0] !== 0) {
      octx.fillStyle = "red";
      octx.textAlign = "right";
      octx.textBaseline = "top";
      octx.fillText("\u2190", this.pad_x / 2, h - this.pad_y + gap);
    }
    this._apply_font();
  }

  private _draw_grid_and_labels(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    step_x?: number,
    step_y?: number,
    scale_x?: number,
    scale_y?: number
  ) {
    if (
      step_x === undefined ||
      step_y === undefined ||
      scale_x === undefined ||
      scale_y === undefined
    ) {
      return;
    }

    const gap = this.font_size * 0.35;

    // grid
    ctx.strokeStyle = this._colors().grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= BARS; k++) {
      const pos_x = this.pad_x + k * step_x * scale_x;
      ctx.moveTo(Math.round(pos_x) + 0.5, Math.round(this.pad_y) + 0.5);
      ctx.lineTo(Math.round(pos_x) + 0.5, Math.round(h - this.pad_y) + 0.5);
    }
    for (let k = 0; k <= BARS; k++) {
      const pos_y = h - this.pad_y - k * step_y * scale_y;
      ctx.moveTo(Math.round(this.pad_x) + 0.5, Math.round(pos_y) + 0.5);
      ctx.lineTo(Math.round(w - this.pad_x) + 0.5, Math.round(pos_y) + 0.5);
    }
    ctx.stroke();

    // labels
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this._colors().text;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let k = 0; k <= BARS; k++) {
      const x = this.data_x_range[0] + k * step_x;
      const pos_x = this.pad_x + (x - this.data_x_range[0]) * scale_x;
      ctx.fillText(this._tick_label(x, step_x), pos_x, h - this.pad_y + gap);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let k = 0; k <= BARS; k++) {
      const y = this.data_y_range[0] + k * step_y;
      const pos_y = h - this.pad_y - (y - this.data_y_range[0]) * scale_y;
      ctx.fillText(this._tick_label(y, step_y), this.pad_x - gap, pos_y);
    }
    ctx.globalAlpha = 1;
  }

  private _blit() {
    const canvas = this.canvas_ref.current;
    const offscreen = this.offscreen;
    if (!canvas || !offscreen || !this.ctx) return;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.drawImage(offscreen, 0, 0);
  }

  private _canvas_coords(e: { clientX: number; clientY: number }): [number, number] {
    const canvas = this.canvas_ref.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const scale_x = canvas.width / rect.width;
    const scale_y = canvas.height / rect.height;
    return [(e.clientX - rect.left) * scale_x, (e.clientY - rect.top) * scale_y];
  }

  private _hover_point(mx: number, my: number) {
    const ctx = this.ctx;
    if (!ctx || this.screen_coords.length === 0) return;

    const data = this.props.data;
    const r = Math.min(this.internal_width, this.internal_height) / CIRCLE_RADIUS_RATIO;

    // binary search on sx (always increasing)
    let lo = 0;
    let hi = this.screen_coords.length - 1;
    while (lo < hi) {
      const mid = lo + ((hi - lo) >> 1);
      if (this.screen_coords[mid].sx < mx) lo = mid + 1;
      else hi = mid;
    }

    let best = -1;
    let best_dist = Infinity;
    for (const i of [lo - 1, lo]) {
      if (i < 0 || i >= this.screen_coords.length) continue;
      const dist = Math.hypot(
        mx - this.screen_coords[i].sx,
        my - this.screen_coords[i].sy
      );
      if (dist < best_dist) {
        best_dist = dist;
        best = i;
      }
    }

    if (best !== -1 && best_dist <= r * 2) {
      const { sx, sy, di } = this.screen_coords[best];
      const hover_font = this.font_size * 1.4;
      ctx.font = `${hover_font}px ${FONT_FAMILY}`;
      ctx.fillStyle = this._colors().hover;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const label = `${data[di][0]}, ${Number(data[di][1].toFixed(2))}`;
      let tx = sx + hover_font * 0.4;
      if (tx + ctx.measureText(label).width > this.internal_width - hover_font) {
        tx = sx - ctx.measureText(label).width - hover_font * 0.4;
      }
      let ty = sy - hover_font * 0.4;
      if (ty - hover_font < 0) ty = sy + hover_font;
      ctx.fillText(label, tx, ty);
      // restore font for next render
      this._apply_font();
    }
  }

  private _on_pointerdown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.last_x = e.clientX;
  };

  private _on_pointermove = (e: PointerEvent) => {
    const canvas = this.canvas_ref.current;
    if (!canvas) return;
    canvas.style.cursor = "pointer";

    const [mx, my] = this._canvas_coords(e);
    this._blit();
    this._hover_point(mx, my);

    if (!this.dragging) return;
    const dx = e.clientX - this.last_x;
    const data = this.props.data;
    if (dx < 0) {
      if (this.current_view[1] !== data.length - 1) {
        this.current_view[0]++;
        this.current_view[1]++;
        this._render_static(this.current_view);
        this._blit();
        this.setState({ show_reset: true });
      }
    } else if (dx > 0) {
      if (this.current_view[0] !== 0) {
        this.current_view[0]--;
        this.current_view[1]--;
        this._render_static(this.current_view);
        this._blit();
        this.setState({ show_reset: true });
      }
    }
    this.last_x = e.clientX;
  };

  private _on_pointerup = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragging = false;
    const canvas = this.canvas_ref.current;
    canvas?.releasePointerCapture(e.pointerId);
  };

  private _on_pointerleave = () => {
    const canvas = this.canvas_ref.current;
    if (canvas) canvas.style.cursor = "default";
    this.dragging = false;
  };

  private _on_wheel = (e: WheelEvent) => {
    e.preventDefault();
    const data = this.props.data;
    if (data.length === 0) return;

    const [mx] = this._canvas_coords(e);

    const t = Math.min(Math.max((mx - this.pad_x) / this.plot_w, 0), 1);
    const a = this.current_view[0];
    const b = this.current_view[1];
    const span = b - a;
    const anchor = a + t * span;

    let s = e.deltaY < 0 ? span * 0.8 : span * 1.25;
    if (e.deltaY > 0 && s >= data.length - 1) {
      this._render_static();
      this._blit();
      return;
    }
    s = Math.min(Math.max(s, 2), data.length - 1);

    const na = Math.round(anchor - t * s);
    this._render_static([na, na + Math.round(s)]);
    this._blit();
    this.setState({ show_reset: true });
  };

  private _on_dblclick = () => {
    this._render_static();
    this._blit();
  };

  private _on_reset = () => {
    this._render_static();
    this._blit();
  };

  render() {
    const is_dark = this.state.current_theme === "monokai";

    return (
      <div className={this.state.current_theme}>
        {this.props.title ? (
          <div className="lighttext" style={{ marginBottom: "4px", fontSize: "0.9em" }}>
            {this.props.title}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
          <div
            ref={this.container_ref}
            style={{
              position: "relative",
              width: this.initial_width || "100%",
              maxWidth: this.props.maxSize,
              minWidth: this.props.minSize,
              height: this.internal_height || undefined,
              resize: "horizontal",
              overflow: "auto"
            }}
          >
            <canvas
              ref={this.canvas_ref}
              className="pointer"
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                outline: `1px solid ${is_dark ? "#555" : "#c3c3c3"}`
              }}
            />
          </div>
          <button
            className="btn btn-default btn-xs pointer"
            style={{
              display: this.state.show_reset ? "inline-block" : "none",
              flexShrink: 0
            }}
            onClick={this._on_reset}
            title="Click this or Double click the graph to reset zoom/pan"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }
}

export default Graph;
