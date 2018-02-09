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
        return (<React.Fragment>
                <span onClick={onclick} className={cls} title={`click to view ${this.props.fullname}`}>
                    {this.props.file}{sep}{line} {this.props.num_lines ? `(${this.props.num_lines} lines total)` : ''}
                </span>

                <CopyToClipboard content={(this.props.fullname || this.props.file)} />
              </React.Fragment>)
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
