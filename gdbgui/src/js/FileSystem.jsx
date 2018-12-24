import React from "react";

const mime_types = {
  // 'file':              /.*/g,
  'word': /\.(docx?)$/,
  'video': /\.(mp4|mov)$/,
  // 'upload':         [/\.()$/],
  'signature': /\.(pem)$/,
  'prescription': /\.(rb)$/,
  'powerpoint': /\.(ptx)$/,
  'pdf': /\.(pdf)$/,
  'medical-alt': /\.(log)$/,
  'medical': /\.(txt)$/,
  // 'invoice-dollar': [/\.()$/],
  // 'invoice':        [/\.()$/],
  // 'import':         [/\.()$/],
  'image': /\.(jpe?g|png|svg)$/,
  // 'export':         [/\.()$/],
  'excel': /\.(xlsx?)$/,
  // 'download': /\.()$/,
  'csv': /\.(csv)$/,
  // 'contract':       [/\.()$/],
  'code': /\.(jsx?|html?|py|cp?p?|cxx)$/,
  'support': /\.(pyc|hp?p?|hxx)$/,
  'audio': /\.(mp3|ogg|wav)$/,
  'archive': /\.(zip|tar|gz|xz|rar|bz2?)$/,
}

const fa_mime_icon = {
  'file': 'fa-file',
  'word': 'fa-file-word',
  'video': 'fa-file-video',
  'upload': 'fa-file-upload',
  'signature': 'fa-file-signature',
  'prescription': 'fa-file-prescription',
  'powerpoint': 'fa-file-powerpoint',
  'pdf': 'fa-file-pdf',
  'medical-alt': 'fa-file-medical-alt',
  'medical': 'fa-file-medical',
  'invoice-dollar': 'fa-file-invoice-dollar',
  'invoice': 'fa-file-invoice',
  'import': 'fa-file-import',
  'image': 'fa-file-image',
  'export': 'fa-file-export',
  'excel': 'fa-file-excel',
  'download': 'fa-file-download',
  'csv': 'fa-file-csv',
  'contract': 'fa-file-contract',
  'code': 'fa-file-code',
  'support': 'fa-chess-knight',
  'audio': 'fa-file-audio',
  'archive': 'fa-file-archive',
}

class FileSystem extends React.Component {
  get_node_jsx(node, depth = 0) {
    if (!node) {
      return null;
    }
    this.nodecount++;

    let get_child_jsx_for_node = node => {
      if (!(node.children && node.toggled)) {
        return null;
      }
      return <ul className='list-unstyled'>{node.children.map(child => this.get_node_jsx(child, depth + 1))}</ul>;
    };
    let indent = "\u00A0\u00A0\u00A0".repeat(depth),
      glyph = null;
    let is_file = !node.children,
      is_dir = !is_file;
    if (is_dir) {
      glyph = node.toggled ? 'fa-chevron-down' : 'fa-chevron-right';
    } else {
      // find the key in mime_types that node.name matched with the regex in value of mime_types[key]
      let mime_key = _.chain(mime_types)
        .entries()
        // eslint-disable-next-line
        .filter(([_, r]) => node.name.match(r))
        .flatten()
        .value()[0]
      glyph = fa_mime_icon[mime_key] || 'fa-file'
    }

    let onClickName = null;
    if (is_file) {
      onClickName = () => {
        this.props.onClickName(node);
      };
    } else {
      onClickName = () => {
        this.props.onToggle(node);
      };
    }

    return (
      <React.Fragment key={this.nodecount}>
        <li>
          {indent}
          <span className={`cursor-pointer m-1 fa ${glyph}`}
                onClick={() => {
                  this.props.onToggle(node);
                }}/>
          <span className='cursor-pointer' onClick={onClickName}>{node.name}</span>
        </li>
        {get_child_jsx_for_node(node)}
      </React.Fragment>
    );
  }

  render() {
    this.nodecount = -1;
    return (
      <div id='filesystem' className='m-1'>
        <ul className='list-unstyled'>{this.get_node_jsx(this.props.rootnode)}</ul>
      </div>
    );
  }
}

export default FileSystem;
