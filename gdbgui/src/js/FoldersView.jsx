import React from 'react'
import {store} from './store.js'
import FileOps from './FileOps.jsx'
import constants from './constants.js'
import {Treebeard} from 'react-treebeard'
import SourceFileAutocomplete from './SourceFileAutocomplete.jsx'
import Actions from './Actions.js'


function get_child_node(name, curnode){
    if(!curnode.children){
        return null
    }
    for(let node of curnode.children){
        if(node.name === name){
            return node
        }
    }
    return null
}

class FoldersView extends React.Component {
    MAX_ENTRIES = 300
    constructor(props){
        super(props)
        this.state = {data:
                {name: 'Load inferior program, then click "Fetch source files" to populate this window'},
                has_hidden_entries: false,
                source_code_state: store.get('source_code_state')
            }
        this.onToggle = this.onToggle.bind(this)
        this.reveal_path = this.reveal_path.bind(this)
        this.update_filesystem_data = this.update_filesystem_data.bind(this)
        this.expand_all = this.expand_all.bind(this)
        this.collapse_all = this.collapse_all.bind(this)
        store.subscribe(this._store_change_callback.bind(this))
    }
    _store_change_callback(keys){
        if(keys.indexOf('source_file_paths') !== -1){
            this.update_filesystem_data(store.get('source_file_paths'))
        }

        if(keys.indexOf('source_code_state') !== -1){
            this.setState({source_code_state: store.get('source_code_state')})
        }
    }
    reveal_path(path){
        if(!path){
            return
        }

        if(this.state.cursor){
            this.state.cursor.active = false
        }

        if(this.props.project_home){
            path = path.replace(this.props.project_home, '')
        }

        let names = path.split('/').filter(n => n !== '')
        , curnode = this.state.data
        curnode.toggled = true  // expand the root
        for(let name of names){
            curnode = get_child_node(name, curnode)
            if(curnode){
                curnode.toggled = true
            }else{
                break
            }
        }

        if(curnode){
            curnode.active = true
        }
        this.setState({data: this.state.data,  cursor: curnode})
    }
    update_filesystem_data(source_paths){
        if(!_.isArray(source_paths) || !source_paths.length){
            this.setState({data:
                {name: 'Load inferior program, then click "Fetch source files" to populate this window'}
            })
            return
        }

        let data = {
            name: this.props.project_home || 'root',
            toggled: true,
            children: [],
        };


        let entry_num = 0
        , has_hidden_entries = false
        , relative_source_paths = source_paths

        if(this.props.project_home){
            let project_home = this.props.project_home
            relative_source_paths = source_paths
                .filter(p => p.startsWith(project_home))
                .map(
                    p => {
                        p = p.replace(project_home, '')
                        return p
                    }
                )
        }
        for(let path of relative_source_paths){
            let new_node
            , names = path.split('/').filter(n => n !== '')
            , curnode = data
            , toggled = depth === 0
            let depth = 0
            for(let name of names){
                let child = get_child_node(name, curnode)
                if(child){
                    // found an existing child node, use it
                   curnode = child
                }else{
                    // add child and set it to cur node
                    new_node = {name: name, toggled: toggled, parent: curnode}
                    if(curnode.children){
                        curnode.children.push(new_node)
                    }else{
                        curnode.children = [new_node]
                    }
                    curnode = new_node
                }

                depth++
            }

            entry_num++
            if(entry_num >= this.MAX_ENTRIES){
                has_hidden_entries = true
                break
            }
        }

        this.setState({data: data, 'has_hidden_entries': has_hidden_entries})
    }

    onToggle(node, toggled){
        if(this.state.cursor){
            this.state.cursor.active = false;
        }
        node.active = false;
        if(node.children && node.children.length){
            node.toggled = toggled;
        }else{
            // compute full path to this node
            // this node has no children (i.e. it's a file)
            let curnode = node
            , path = []
            while(curnode){
                if(curnode.name === 'root'){
                    path.unshift('')
                    break
                }
                // prepend this file/directory to the path
                path.unshift(curnode.name)
                // try to prepend the parent
                curnode = curnode.parent
            }
            if(path.length){
                FileOps.user_select_file_to_view(path.join('/'), 1)
            }
        }
        this.setState({cursor: null})
    }
    expand_all(){
        let callback = (node)=>{
            node.toggled = true
        }
        for(let top_level_child of this.state.data.children){
            this._dfs(top_level_child, callback)
        }
        this.setState({data: this.state.data})
    }
    collapse_all(){
        let callback = (node)=>{
            node.toggled = false
        }
        for(let top_level_child of this.state.data.children){
            this._dfs(top_level_child, callback)
        }
        this.setState({data: this.state.data})
    }
    _dfs(node, callback){
        callback(node)
        if(node.children){
            for(let child of node.children){
                this._dfs(child, callback)
            }
        }
    }
    render(){
        let source_code_state = store.get('source_code_state')
        , file_is_rendered = source_code_state === constants.source_code_states.SOURCE_CACHED ||
                             source_code_state === constants.source_code_states.ASSM_AND_SOURCE_CACHED
        , can_reveal = file_is_rendered && store.get('source_file_paths').length

        return (
            <div>
                <button
                    className='btn btn-xs btn-primary'
                    onClick={Actions.fetch_source_files}
                    style={{'marginLeft': '5px', marginTop: '5px'}}
                >
                    Fetch source files
                </button>

                <div style={{width: '100%'}}>
                    <SourceFileAutocomplete />
                </div>
                <div role="group" className="btn-group btn-group" style={{'padding': '4px'}}>

                    <button
                        className='btn btn-xs btn-default'
                        onClick={this.expand_all}
                    >
                        Expand all
                    </button>

                    <button
                        className='btn btn-xs btn-default'
                        onClick={this.collapse_all}
                    >
                        Collapse all
                    </button>

                    <button
                        className={'btn btn-xs btn-default ' +( can_reveal ? '': 'hidden')}
                        onClick={() => this.reveal_path(store.get('fullname_to_render'))}
                    >
                        Reveal current file
                    </button>

                </div>

                {store.get('source_file_paths').length ?

                <p style={{color: 'white', 'padding': '4px'}}>
                {store.get('source_file_paths').length} known files used to compile the inferior program
                </p>
                : ''
                }

                {this.state.has_hidden_entries ?
                    <p style={{color: 'black', 'background': 'orange', 'padding': '4px'}}>
                    Maximum entries to be displayed is {this.MAX_ENTRIES} (hiding {store.get('source_file_paths').length - this.MAX_ENTRIES})
                    </p>
                    : ''
                }

                {/*https://github.com/alexcurtis/react-treebeard*/}
                <Treebeard
                    data={this.state.data}
                    onToggle={this.onToggle}
                />
            </div>
        );
    }
}

export default FoldersView
