import React from "react";
import FileOps from "./FileOps";
import Util from "./Util";
import CompletionDropdown from "./CompletionDropdown";

/**
 * Thin wrapper around CompletionDropdown for source files.
 * Selecting a file or typing an explicit path and pressing enter asks
 * gdb to view that file (optionally with a :line suffix).
 */

type SourceFileAutocompleteProps = {
  file_paths: string[];
};

class SourceFileAutocomplete extends React.Component<SourceFileAutocompleteProps, {}> {
  static defaultProps = { file_paths: [] };

  onFileSelect(name: string) {
    FileOps.user_select_file_to_view(name, 1);
  }

  onSubmit(text: string) {
    const user_input = text.trim();
    if (user_input.length === 0) {
      return;
    }
    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '0' is not assignable to parameter of type 'undefined'
    const [fullname, line] = Util.parse_fullname_and_line(user_input, 0);
    FileOps.user_select_file_to_view(fullname, line);
  }

  render() {
    return (
      <div style={{ width: "100%", flex: "1 0", padding: "5px" }} className="flex">
        <CompletionDropdown
          list={this.props.file_paths}
          placeholder="Enter file path to view, press enter"
          onSelect={this.onFileSelect.bind(this)}
          onSubmit={this.onSubmit.bind(this)}
          maxItems={10}
          showAllOnEmpty
        />
      </div>
    );
  }
}

export default SourceFileAutocomplete;
