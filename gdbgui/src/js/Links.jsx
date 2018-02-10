import Actions from './Actions.js';
import React from 'react';
import CopyToClipboard from './CopyToClipboard.jsx';


class FileLink extends React.Component {
    render(){
        let line = parseInt(this.props.line)
        let onclick = null
        , cls = ''
        if (!this.props.file || !line){
            line = ''
        }
        let sep = ''
        if(line && line !== 0){
            sep = ':'
        }
        if(this.props.fullname){
            onclick = ()=>Actions.view_file(this.props.fullname, line)
            cls = 'pointer'
        }

        let clipboard_content = null
        if(this.props.fullname || this.props.file){
          clipboard_content = (this.props.fullname || this.props.file) + sep + line
        }
        return (<div style={{display: 'inline-block', 'whitespace': 'nowrap'}}>
                <span onClick={onclick}
                      className={cls}
                      title={`click to view ${this.props.fullname}`}
                      style={{display: 'inline'}}
                >
                    {this.props.file}{sep}{line}
                </span>

                <CopyToClipboard content={clipboard_content}  />
                {this.props.num_lines ? `(${this.props.num_lines} lines total)` : ''}
              </div>)
    }
}

class FrameLink extends React.Component {
    render(){
        return (
            <div>
                <FileLink fullname={this.props.fullname} file={this.props.file} line={this.props.line} />
                <span style={{'whiteSpace': 'pre'}}> </span>
                <MemoryLink addr={this.props.addr} />
            </div>
        )
    }
}


module.exports = {
    FileLink: FileLink,
    FrameLink: FrameLink,
}
