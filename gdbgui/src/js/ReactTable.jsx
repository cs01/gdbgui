import React from "react";

class TableRow extends React.Component {
  get_tds() {
    let tds = [];
    for (let i in this.props.data) {
      tds.push(<td key={i}>{this.props.data[i]}</td>);
    }
    return tds;
  }

  render() {
    return <tr className={this.className}>{this.get_tds()}</tr>;
  }
}

class ReactTable extends React.Component {
  static defaultProps = { header: [] };
  render_row(row_data, i) {
    return <TableRow data={row_data} key={i} />;
  }

  render_head() {
    let ths = [],
      i = 0;
    for (let th_data of this.props.header) {
      ths.push(<th key={i}>{th_data}</th>);
      i++;
    }
    return ths;
  }

  render() {
    let classes = ["table", "table-condensed"].concat(this.props.classes);
    return (
      <table className={classes.join(" ")} style={this.props.style}>
        <thead>
          <tr>{this.render_head()}</tr>
        </thead>
        <tbody>{this.props.data.map(this.render_row)}</tbody>
      </table>
    );
  }
}

export default ReactTable;
