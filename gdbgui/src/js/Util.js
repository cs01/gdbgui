import { store } from "statorgfc";

/**
 * Some general utility methods
 */
const Util = {
  persist_value_for_key: function(key) {
    try {
      let value = store.get(key);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(err);
    }
  },
  /**
   * Get html table
   * @param columns: array of strings
   * @param data: array of arrays of data
   */
  get_table: function(columns, data, style = "") {
    var result = [
      `<table class='table table-bordered table-condensed' style="${style}">`
    ];
    if (columns) {
      result.push("<thead>");
      result.push("<tr>");
      for (let h of columns) {
        result.push(`<th>${h}</th>`);
      }
      result.push("</tr>");
      result.push("</thead>");
    }

    if (data) {
      result.push("<tbody>");
      for (let row of data) {
        result.push("<tr>");
        for (let cell of row) {
          result.push(`<td>${cell}</td>`);
        }
        result.push("</tr>");
      }
    }
    result.push("</tbody>");
    result.push("</table>");
    return result.join("\n");
  },
  /**
   * Escape gdb's output to be browser compatible
   * @param s: string to mutate
   */
  escape: function(s) {
    return s
      .replace(/>/g, "&gt;")
      .replace(/</g, "&lt;")
      .replace(/\\n/g, "<br>")
      .replace(/\\r/g, "")
      .replace(/\\"/g, '"')
      .replace(/\\t/g, "&nbsp");
  },
  /**
   * take a string of html in JavaScript and strip out the html
   * http://stackoverflow.com/a/822486/2893090
   */
  get_text_from_html: function(html) {
    var tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  },
  /**
   * @param fullname_and_line: i.e. /path/to/file.c:78
   * @param default_line_if_not_found: i.e. 0
   * @return: Array, with 0'th element == path, 1st element == line
   */
  parse_fullname_and_line: function(
    fullname_and_line,
    default_line_if_not_found = undefined
  ) {
    let user_input_array = fullname_and_line.split(":"),
      fullname = user_input_array[0],
      line = default_line_if_not_found;
    if (user_input_array.length === 2) {
      line = user_input_array[1];
    }
    return [fullname, parseInt(line)];
  },
  string_to_array_safe_quotes(str) {
    let output = [],
      cur_str = "",
      in_quotes = false;

    for (let i = 0; i < str.length; i++) {
      let char = str[i];

      if (char === '"') {
        in_quotes = !in_quotes;
        cur_str += char;
      } else if (char !== " " || (char === " " && in_quotes)) {
        cur_str += char;
      } else if (char === " ") {
        // got a space outside of quotes
        if (cur_str === "") {
          // a consecutive space. do nothing.
        } else {
          // save this argument, and reset cur_str
          output.push(cur_str);
          cur_str = "";
        }
      }
    }
    if (cur_str !== "") {
      output.push(cur_str);
    }
    return output;
  },
  /* Return true is latest is > current
    1.0.0, 0.9.9 -> true
    0.1.0, 0.0.9 -> true
    0.0.9, 0.0.8 -> false
  */
  is_newer(latest, current) {
    latest = latest.split(".");
    current = current.split(".");
    if (latest.length !== current.length) {
      return true;
    }
    for (let i in latest) {
      if (latest[i] > current[i]) {
        return true;
      }
    }
    return false;
  }
};

export default Util;
