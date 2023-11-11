import React from "react";

class TableRow extends React.Component {
  className: any;
  get_tds() {
    const tds = [];
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'data' does not exist on type 'Readonly<{... Remove this comment to see the full error message
    for (const i in this.props.data) {
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'data' does not exist on type 'Readonly<{... Remove this comment to see the full error message
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
  renderRow(row_data: any, i: any) {
    // @ts-expect-error ts-migrate(2769) FIXME: Property 'data' does not exist on type 'IntrinsicA... Remove this comment to see the full error message
    return <TableRow data={row_data} key={i} />;
  }

  renderHead() {
    const ths = [];
    let i = 0;
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'header' does not exist on type 'Readonly... Remove this comment to see the full error message
    for (const th_data of this.props.header) {
      ths.push(<th key={i}>{th_data}</th>);
      i++;
    }
    return ths;
  }

  render() {
    // @ts-expect-error ts-migrate(2339) FIXME: Property 'classes' does not exist on type 'Readonl... Remove this comment to see the full error message
    const classes = ["table", "table-condensed"].concat(this.props.classes);
    return (
      // @ts-expect-error ts-migrate(2339) FIXME: Property 'style' does not exist on type 'Readonly<... Remove this comment to see the full error message
      <table className={classes.join(" ")} style={this.props.style}>
        <thead>
          <tr>{this.renderHead()}</tr>
        </thead>
        {/* @ts-expect-error ts-migrate(2339) FIXME: Property 'data' does not exist on type 'Readonly<{... Remove this comment to see the full error message */}
        <tbody>{this.props.data.map(this.renderRow)}</tbody>
      </table>
    );
  }
}

export default ReactTable;
