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
      current_theme: store.get("current_theme")
    };
    this.items = this.make_dropdown_items(props.list);
  }

  componentDidMount() {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'connectComponentState' does not exist on type ...
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
    let temp_str_l = 0;
    let last_type = -1; // 0 means lowercase, 1 means upper case, 2 means digit
    for (let i = 0; i < str.length; i++) {
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
        if (temp_str_l > 0) {
          str_array.push(temp_str);
          temp_str_l = 0;
          temp_str = "";
        }
      } else if (curr_type >= 0) {
        if (
          (curr_type === 2 && last_type !== 2) ||
          (curr_type === 1 && last_type === 0)
        ) {
          if (temp_str_l > 0) {
            str_array.push(temp_str);
            temp_str_l = 0;
            temp_str = "";
          }
        }
        temp_str_l++;
        temp_str += char;
      } else {
        if (temp_str_l > 0) {
          str_array.push(temp_str);
          temp_str_l = 0;
          temp_str = "";
        }
      }
      last_type = curr_type;
    }
    if (temp_str_l > 0) {
      str_array.push(temp_str);
    }
    return str_array;
  }

  // least to towards edges, max at around 80% then again reduce
  // more emphasis to file name, then extension then folder/path
  position_score(i: number, len: number): number {
    const t = i / (len - 1);

    let weight: number;
    if (t < 0.8) weight = 0.4 + 0.8 * t;
    else weight = 1.04 - (0.3 * (t - 0.8)) / 0.2;

    return weight;
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

  // arr1 is the search term, arr2 the string to search in
  match_score(arr1: string[], arr2: string[]): number {
    let match_score = 0;
    let last_match = -1;
    let matched = 0;
    let found2 = Array(arr2.length).fill(false);
    for (let fa of arr1) {
      let current_match_score = 0;
      let best_i = -1;
      let best_l = Infinity;
      for (let i = 0; i < arr2.length; i++) {
        let l = 10000000;
        if (arr2[i] === fa) {
          best_l = 0;
          best_i = i;
          break;
        }
        const index = arr2[i].indexOf(fa);
        if (index === 0) {
          l = (arr2[i].length - fa.length) / arr2[i].length;
        } else if (index > 0) {
          l = (arr2[i].length + index) / (2 * arr2[i].length);
        } else {
          if (Math.abs(fa.length - arr2[i].length) > 3) {
            l = 1;
          } else {
            l =
              this.damerauLevenshtein(fa, arr2[i]) / Math.max(fa.length, arr2[i].length);
          }
        }
        if (l < best_l) {
          best_l = l;
          best_i = i;
        }
      }
      if (best_l > 0.7) {
        current_match_score += 0;
        continue;
      }

      if (best_l === 0) {
        current_match_score += 100;
      } else {
        current_match_score += 100 * (1 - best_l * best_l);
      }

      if (last_match === -1) {
        last_match = best_i;
      } else {
        // add points for correct order, and close by
        if (best_i <= last_match) current_match_score -= 20;
        else {
          current_match_score += Math.max(30 - (best_i - last_match - 1) * 2, 0);
          if (best_i - last_match === 1) {
            // a bit more score for consecutive match
            current_match_score += 20;
          }
          last_match = best_i;
        }

        if (!found2[best_i]) {
          // not repeat find
          current_match_score += 50;
          found2[best_i] = true;
        }
      }

      // matched another search token
      matched++;

      // IMP: specifically for file paths, matching file names (ignoring other path, ext) is bonus
      current_match_score += 50 * this.position_score(best_i, arr2.length);

      match_score += current_match_score * fa.length;
    }
    if (matched === arr1.length) {
      match_score += 30;
    }
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
      if (this.props.showAllOnEmpty) {
        results = this.items.map(item => item.text);
      }
    } else {
      const field_array = this.make_array_of_str(term);
      const scores: Array<{ i: number; score: number }> = [];
      for (let i = 0; i < this.items.length; i++) {
        scores.push({ i, score: this.match_score(field_array, this.items[i].tokens) });
      }
      scores.sort((a, b) => b.score - a.score);
      for (const obj of scores) {
        if (obj.score <= 0) break;
        results.push(this.items[obj.i].text);
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
          onBlur={() => this.setState({ results: [], currentIndex: -1 })}
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
