/**
 * The project view div will be rendered with this content
 */

import React from 'react';
import {store} from './store.js';
import FileOps from './FileOps.jsx';
import {project} from './Project.js';

let btn_class = 'btn btn-default btn-sm'

const ProjectViewApi = {
    openAll : function() {
        $('#project_view>#content').jstree('open_all');
    },
    closeAll : function() {
        $('#project_view>#content').jstree('close_all');
    },
    search : function(text) {
        $('#project_view>#content').jstree(true).search(text);
    },
    reveal : function() {
        let viewed_file = FileOps.get_viewed_file();
        let $tree = $('#project_view>#content');
        let jstree = $tree.jstree(true);
        let node_to_select;
        $(jstree.get_json($tree, {
                flat: true,
                no_state: true, no_li_attr: true, no_a_attr: true
            }))
            .each(function(index, value) {
                let node_data = jstree.get_node(value).original;
                if (node_data.filePath === viewed_file) {
                    node_to_select = node_data.id;
                    return false;
                }
            });
        if (node_to_select != null) {
            $tree.jstree("deselect_all")
            $tree.jstree('select_node', node_to_select);
        }
    }
}

const tools =
	<div role="group" className="btn-group btn-group-xs" style={{flex: '0 1 auto'}}>
		<button id="search_button"
			type="button"
			title="Search resources inside project directory (keyboard shortcut: f)"
			className={btn_class}><span className="glyphicon glyphicon-search" />
		</button>
		<button id="expand_all_button"
			onClick={ProjectViewApi.openAll}
			type="button"
			title="Open all nodes"
			className={btn_class}><span className="glyphicon glyphicon-resize-full" />
		</button>
		<button id="collapse_all_button"
			onClick={ProjectViewApi.closeAll}
			type="button"
			title="Close all nodes"
			className={btn_class}><span className="glyphicon glyphicon-resize-small" />
		</button>
		<button id="show_resource_button"
			onClick={ProjectViewApi.reveal}
			type="button"
			title="Show selected resource"
			className={btn_class}><span className="glyphicon glyphicon-asterisk" />
		</button>
	</div>

class ProjectView extends React.Component {
    constructor(){
        super()
        store.subscribe(this._store_change_callback.bind(this))
    }
    _store_change_callback(keys){
        let needPopulate = false;
        if(_.intersection(['project_home'], keys).length){
            let project_home = store.get('project_home');
            if (project_home) project.setHome(project_home);
            needPopulate = true;
        }
        if(_.intersection(['source_file_paths'], keys).length){
            let project_home = store.get('project_home');
            if (project_home) {
                project.setHome(project_home);
            } else {
                // remove view
            }
            needPopulate = true;
        }
        if (needPopulate) this.populateProject(project);
    }

    render(){
        return <div id='project_view' style={{'height': '100%', 'display': 'flex', 'flex-flow': 'column'}}>
                    {tools}
                    <div id="resources_search" style={{display: 'none', flex: '0 1 auto'}}>
                        <input id="text" type="text" placeholder="Enter resource name" style={{width: '100%'}} />
                    </div>
                    <div id="content" style={{flex: '0 1 auto', overflow: 'auto', height:'100%'}}>

                    </div>
               </div>
    }

    populateProject(project) {
        let paths = store.get('source_file_paths');
        let jsTree = $('#project_view #content').jstree(true);
        let data = [];
        let project_data =
        {
            id          : "<project>",
            text        : project.name,
            icon        : "glyphicon glyphicon-home",
            state       : {
                opened    : true
            },
            children    : []
        };
        data.push(project_data);

        for ( var pathKey in paths ) {
            var path = paths[pathKey];
            if (path.startsWith(project.home)) {
                var relativePath = path.substring(project.home.length);
                var parts = relativePath.match(/(\/[^\\/]+(\/+$)?)/g);
                var childData = this.getNodeDataForPath(project_data, parts);
                childData.filePath = path;
                childData.sourceFileIndex = pathKey;
            }
        }
        jsTree.settings.core.data = data;
        jsTree.refresh(false, true);
    }

    getNodeDataForPath(project_data, parts) {
        var dataPart = project_data;
        var lastPart = parts.splice(-1,1)[0];

        var path = "";
        var childDataPart;

        for (var partKey in parts) {
            var partPath = parts[partKey];
            path = path + partPath;
            var found = false;
            for (var dataPartKey in dataPart.children) {
                childDataPart = dataPart.children[dataPartKey];
                if (childDataPart.id === path) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                childDataPart = {
                    id          : path,
                    text        : partPath.substring(1),
                    icon        : "glyphicon glyphicon-folder-open",
                    state       : {
                        opened    : false
                    },
                    children    : []
                };
                dataPart.children.push(childDataPart);
            }

            dataPart = childDataPart;
        }

        childDataPart = {
            id          : path+lastPart,
            text        : lastPart.substring(1).replace(/\/*$/,""),
            icon        : "glyphicon glyphicon-file",
        };
        dataPart.children.push(childDataPart);

        return childDataPart;
    }

    componentDidMount() {
        var jsTree = $('#project_view>#content').jstree({
            "core" : {
                "animation" : 0,
                "check_callback" : true,
                "themes" : { "stripes" : true }
            },
            "types" : {
                "#" : {
					"max_children" : 1,
					"max_depth" : 4,
					"valid_children" : ["root"]
                },
                "root" : {
					"icon" : "/static/3.3.4/assets/images/tree_icon.png",
					"valid_children" : ["default"]
                },
                "default" : {
                    "valid_children" : ["default","file"]
                },
                "file" : {
					"icon" : "glyphicon glyphicon-file",
					"valid_children" : []
                }
            },
            "plugins" : [
                //"contextmenu",
                //"dnd",
                "search",
                "state", "types", "wholerow"
            ]
        });

        $('#search_button').on('click',function () {
            let box = $('#resources_search');
            if (box.css('display') == 'none')
                $('#resources_search').slideDown();
            else
                $('#resources_search').slideUp();
        });

        let timeoutUpdateSearchResult = false;
        $('#resources_search>#text').keyup(function () {
            if(timeoutUpdateSearchResult) { clearTimeout(timeoutUpdateSearchResult); }
            timeoutUpdateSearchResult = setTimeout(function () {
                let v = $('#resources_search>#text').val();
                ProjectViewApi.search(v);
            }, 250);
        });

        jsTree.on("dblclick.project.jsTree", function (event) {
            var node_data = $(this).jstree().get_node(event.target).original;
            if (node_data.sourceFileIndex!=null) {
                var file = store.get('source_file_paths')[node_data.sourceFileIndex];
                if (file!=null)
                    FileOps.user_select_file_to_view(file, 1);
            }
        });

    }
}

export default ProjectView
