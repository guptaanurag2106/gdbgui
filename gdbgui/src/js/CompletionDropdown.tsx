import React from "react";
import { store } from "statorgfc";

type CompletionDropdownProps = {
  list: string[];
  onSelect?: (text: string) => void;
  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;
  placeholder?: string;
  initialValue?: string;
  debounceDelay?: number;
  maxItems?: number;
  showAllOnEmpty?: boolean;
};

type CompletionDropdownState = {
  term: string;
  results: string[];
  currentIndex: number;
  current_theme: string;
  isFocused: boolean;
};

type DropdownItem = {
  text: string;
  tokens: string[];
};

const ROW_HEIGHT = 26;

class CompletionDropdown extends React.Component<
  CompletionDropdownProps,
  CompletionDropdownState
> {
  items: DropdownItem[] = [];
  timer: number | null = null;
  ulRef = React.createRef<HTMLUListElement>();
  _search_tokens: string[] = [];
  _damerau_cache: Map<string, number> = new Map();

  static defaultProps = {
    debounceDelay: 10,
    maxItems: 10
  };

  constructor(props: CompletionDropdownProps) {
    super(props);
    this.state = {
      term: this.props.initialValue || "",
      results: [],
      currentIndex: -1,
      current_theme: store.get("current_theme"),
      isFocused: false
    };
    this.items = this.make_dropdown_items(props.list);
  }

  componentDidMount() {
    store.connectComponentState(this, ["current_theme"]);
  }

  componentDidUpdate(
    prevProps: CompletionDropdownProps,
    prevState: CompletionDropdownState
  ) {
    if (prevProps.list !== this.props.list) {
      this.items = this.make_dropdown_items(this.props.list);
      this.search(this.state.term);
    }
    if (prevState.results !== this.state.results && this.ulRef.current) {
      this.ulRef.current.scrollTop = 0;
    }
  }

  make_array_of_str(str: string): string[] {
    let str_array: string[] = [];
    let temp_str = "";
    let last_type = -1; // 0 means lowercase, 1 means upper case, 2 means digit
    const str_len = str.length;
    for (let i = 0; i < str_len; i++) {
      let char = str[i];
      let curr_type = -1;
      const code = char.charCodeAt(0);
      if (code >= 97 && code <= 122) {
        curr_type = 0;
      } else if (code >= 65 && code <= 90) {
        curr_type = 1;
        char = String.fromCharCode(code + 32);
      } else if (code >= 48 && code <= 57) {
        curr_type = 2;
      }

      if (char === " " || char === "\n" || char === "\r" || char === "\t") {
        if (temp_str.length > 0) {
          str_array.push(temp_str);
          temp_str = "";
        }
      } else {
        if (curr_type >= 0) {
          if (
            (curr_type === 1 && last_type === 0) ||
            (curr_type === 2 && last_type !== 2)
          ) {
            if (temp_str.length > 0) {
              str_array.push(temp_str);
              temp_str = "";
            }
          }
          temp_str += char;
          last_type = curr_type;
        } else {
          if (temp_str.length > 0) {
            str_array.push(temp_str);
            temp_str = "";
          }
          continue;
        }
      }
    }
    if (temp_str.length > 0) {
      str_array.push(temp_str);
    }
    return str_array;
  }

  // least to towards edges, max at around 80% then again reduce
  // more emphasis to file name, then extension then folder/path
  // so gradual increase from 0 to rise_end, then plateau around rise_end to fall_start, then fall down
  position_score(i: number, len: number): number {
    const t = i / (len - 1);
    const rise_end = 0.7;
    const fall_start = 0.9;

    function smoothstep(x: number): number {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    }

    if (t < rise_end) {
      return 0.5 + 0.5 * smoothstep(t / rise_end);
    }

    if (t < fall_start) {
      return 1.0;
    }

    const s = smoothstep((t - fall_start) / (1.0 - fall_start));
    return 1.0 - 0.25 * s;
  }

  damerauLevenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const INF = m + n;

    const H = Array.from({ length: m + 2 }, () => new Int32Array(n + 2));

    H[0][0] = INF;

    for (let i = 0; i <= m; i++) {
      H[i + 1][1] = i;
      H[i + 1][0] = INF;
    }

    for (let j = 0; j <= n; j++) {
      H[1][j + 1] = j;
      H[0][j + 1] = INF;
    }

    const lastRow = new Int32Array(128);

    for (let i = 1; i <= m; i++) {
      let lastMatchCol = 0;

      const ai = a.charCodeAt(i - 1);

      for (let j = 1; j <= n; j++) {
        const bj = b.charCodeAt(j - 1);

        const i1 = lastRow[bj];
        const j1 = lastMatchCol;

        let cost = 1;
        if (ai === bj) {
          cost = 0;
          lastMatchCol = j;
        }

        const transposition = H[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1);

        H[i + 1][j + 1] = Math.min(
          H[i][j] + cost,
          H[i + 1][j] + 1,
          H[i][j + 1] + 1,
          transposition
        );
      }

      lastRow[ai] = i;
    }

    return H[m + 1][n + 1];
  }

  get_damerau(a: string, b: string): number {
    const key = a + "\0" + b;
    let d = this._damerau_cache.get(key);
    if (d === undefined) {
      d = this.damerauLevenshtein(a, b);
      this._damerau_cache.set(key, d);
    }
    return d;
  }

  // arr1 is the search term, arr2 the string to search in
  match_score(arr2: string[]): number {
    const arr1 = this._search_tokens;
    let match_score = 0;
    let matched = 0;
    const arr2_len = arr2.length;
    let found2 = new Uint8Array(arr2_len);
    const matches: number[] = [];
    let arr1_len = arr1.length;
    for (let i = 0; i < arr1_len; i++) {
      let fa = arr1[i];
      let fa_len = fa.length;
      let current_match_score = 0;
      let best_i = -1;
      let best_l = Infinity;

      for (let j = 0; j < arr2_len; j++) {
        let l = 10000000;
        const arr2_j = arr2[j];
        const arr2_j_len = arr2_j.length;
        if (arr2_j === fa) {
          best_l = 0;
          best_i = j;
          break;
        }
        if (fa_len < arr2_j_len) {
          const index = arr2_j.indexOf(fa);
          if (index >= 0) {
            const x = 1 - fa_len / arr2_j_len;
            l = 0.6 * x * x + index / arr2_j_len;
            if (l < best_l) {
              best_l = l;
              best_i = j;
              continue;
            }
          }
        }

        const len_diff = fa_len - arr2_j_len;
        if (len_diff > 4 || len_diff < -4) {
          l = 1;
        } else {
          l = this.get_damerau(fa, arr2_j) / Math.max(arr2_j_len, fa_len);
        }
        if (l < best_l) {
          best_l = l;
          best_i = j;
        }
      }

      const cap = 0.5;
      if (best_l >= cap) {
        current_match_score += 0;
        match_score += current_match_score;
      } else {
        current_match_score += 80 * (1 - best_l * best_l);

        // Remember the match. Order/proximity is calculated after all
        // search tokens have been matched.
        matches.push(best_i);

        if (found2[best_i]) {
          current_match_score -= 30;
        } else {
          found2[best_i] = 1;
        }

        // IMP: specifically for file paths, matching file names (ignoring other path, ext) is bonus
        current_match_score += 15 * this.position_score(best_i, arr2_len);

        match_score += current_match_score * fa_len;
        // matched another search token
        matched++;
      }
    }
    const matches_len = matches.length;
    for (let i = 1; i < matches_len; i++) {
      const previous = matches[i - 1];
      const current = matches[i];

      // correct order
      if (current > previous) {
        match_score += 50;
      }

      // add points for being close
      const distance = Math.abs(current - previous) - 1;

      // proximity bonus, max 50
      match_score += Math.max(50 - distance * 3, 0);

      if (distance === 0) {
        match_score += 30;
      }
    }
    // penalize every query token that didn't match any candidate token:
    // an all-token match must outrank a partial one
    const matched_ratio = matched / arr1_len;
    match_score *= matched_ratio * matched_ratio;
    return match_score;
  }

  make_dropdown_items(list: string[]): DropdownItem[] {
    const items: DropdownItem[] = [];
    for (const str of list) {
      if (!str) continue;
      items.push({ text: str, tokens: this.make_array_of_str(str) });
    }
    return items;
  }

  on_input_change(e: any) {
    const term = e.currentTarget.value;
    this.setState({ term });
    if (this.props.onChange) this.props.onChange(term);
    if (this.timer) clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.search(term), this.props.debounceDelay);
  }

  search(term: string) {
    let results: string[] = [];
    if (term.trim() === "") {
      if (this.props.showAllOnEmpty && this.state.isFocused) {
        results = this.items.map(item => item.text);
      }
    } else {
      const field_array = this.make_array_of_str(term);
      this._search_tokens = field_array;
      this._damerau_cache.clear();
      const scores: Array<{ i: number; score: number }> = [];
      for (let i = 0; i < this.items.length; i++) {
        const score = this.match_score(this.items[i].tokens);
        if (score != 0) {
          scores.push({ i, score });
        }
      }
      scores.sort((a, b) => b.score - a.score);
      if (scores.length > 0) {
        const max_score = scores[0].score;
        for (const obj of scores) {
          if (obj.score / max_score <= 0.5) break;
          results.push(this.items[obj.i].text);
        }
      }
    }
    this.setState({ results, currentIndex: -1 });
  }

  select(i: number) {
    const text = this.state.results[i];
    if (text === undefined) return;
    this.setState({ term: text, results: [], currentIndex: -1 });
    if (this.props.onSelect) this.props.onSelect(text);
  }

  scroll_active_into_view() {
    const el = this.ulRef.current?.querySelector('li[aria-selected="true"]');
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }

  on_keydown(e: any) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.state.results.length === 0) return;
      const len = this.state.results.length;
      this.setState(
        {
          currentIndex:
            this.state.currentIndex === -1 ? 0 : (this.state.currentIndex + 1) % len
        },
        () => this.scroll_active_into_view()
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.state.results.length === 0) return;
      const len = this.state.results.length;
      this.setState(
        {
          currentIndex:
            this.state.currentIndex === -1
              ? len - 1
              : (this.state.currentIndex - 1 + len) % len
        },
        () => this.scroll_active_into_view()
      );
    } else if (e.key === "Enter") {
      if (this.state.currentIndex >= 0 && this.props.onSelect) {
        e.preventDefault();
        this.select(this.state.currentIndex);
      } else if (this.props.onSubmit) {
        e.preventDefault();
        this.setState({ results: [], currentIndex: -1 });
        this.props.onSubmit(this.state.term);
      }
    } else if (e.key === "Escape") {
      this.setState({ results: [], currentIndex: -1 });
    }
  }

  on_li_mousemove(i: number) {
    if (this.state.currentIndex !== i) {
      this.setState({ currentIndex: i });
    }
  }

  on_li_mousedown(e: any, i: number) {
    e.preventDefault(); // keep focus in the input
    this.select(i);
  }

  render() {
    const { term, results, currentIndex, current_theme } = this.state;
    const show = results.length > 0;
    return (
      <div className={`completionDropdown ${current_theme || ""}`}>
        <input
          className="form-control"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          placeholder={this.props.placeholder}
          value={term}
          onChange={this.on_input_change.bind(this)}
          onKeyDown={this.on_keydown.bind(this)}
          onFocus={() =>
            this.setState({ isFocused: true }, () => this.search(this.state.term))
          }
          onBlur={() => {
            if (this.timer) clearTimeout(this.timer);
            this.setState({ results: [], currentIndex: -1, isFocused: false });
          }}
        />
        <ul
          ref={this.ulRef}
          style={{ maxHeight: this.props.maxItems! * ROW_HEIGHT }}
          hidden={!show}
        >
          {results.map((r, i) => (
            <li
              key={i}
              aria-selected={i === currentIndex}
              onMouseMove={() => this.on_li_mousemove(i)}
              onMouseDown={e => this.on_li_mousedown(e, i)}
            >
              {r}
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

export default CompletionDropdown;
