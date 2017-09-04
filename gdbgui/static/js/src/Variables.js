import {store, Reactor} from './store.js';
import GdbApi from './GdbApi.js';
import Memory from './Memory.js';
import Util from './Util.js';
import constants from './constants.js';

/**
 * The Expressions component allows the user to inspect expressions
 * stored as variables in gdb
 * see https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
 *
 * gdb assigns a unique variable name for each expression the user wants evaluated
 * gdb returns
 */
const Expressions = {
    el: $('#expressions'),
    el_input: $('#expressions_input'),
    init: function(){
        // create new var when enter is pressed
        Expressions.el_input.keydown(Expressions.keydown_on_input)

        new Reactor('#expressions', Expressions.render, {after_render: Expressions.after_render})

        // remove var when trash icon is clicked
        $("body").on("click", ".delete_gdb_variable", Expressions.click_delete_gdb_variable)
        // plot tree when tree icon is clicked
        $("body").on("click", ".draw_tree_gdb_variable", Expressions.click_draw_tree_gdb_variable)
        $("body").on("click", ".toggle_children_visibility", Expressions.click_toggle_children_visibility)
        $("body").on("click", ".toggle_plot", Expressions.click_toggle_plot)
    },
    /**
     * Locally save the variable to our cached variables
     */
    save_new_expression: function(expression, expr_type, obj){
        let new_obj = Expressions.prepare_gdb_obj_for_storage(obj)
        new_obj.expression = expression
        let expressions = store.get('expressions')
        expressions.push(new_obj)
        store.set('expressions', expressions)
    },
    /**
     * Get child variable with a particular name
     */
    get_child_with_name: function(children, name){
        for(let child of children){
            if(child.name === name){
                return child
            }
        }
        return undefined
    },
    get_root_name_from_gdbvar_name: function(gdb_var_name){
        return gdb_var_name.split('.')[0]
    },
    get_child_names_from_gdbvar_name: function(gdb_var_name){
        return gdb_var_name.split('.').slice(1, gdb_var_name.length)
    },
    /**
     * Get object from gdb variable name. gdb variable names are unique, and don't match
     * the expression being evaluated. If drilling down into fields of structures, the
     * gdb variable name has dot notation, such as 'var.field1.field2'.
     * @param gdb_var_name: gdb variable name to find corresponding cached object. Can have dot notation
     * @return: object if found, or undefined if not found
     */
    get_obj_from_gdb_var_name: function(expressions, gdb_var_name){
        // gdb provides names in dot notation
        // let gdb_var_names = gdb_var_name.split('.'),
        let top_level_var_name = Expressions.get_root_name_from_gdbvar_name(gdb_var_name),
            children_names = Expressions.get_child_names_from_gdbvar_name(gdb_var_name)

        let objs = expressions.filter(v => v.name === top_level_var_name)

        if(objs.length === 1){
            // we found our top level object
            let obj = objs[0]
            let name_to_find = top_level_var_name
            for(let i = 0; i < (children_names.length); i++){
                // append the '.' and field name to find as a child of the object we're looking at
                name_to_find += `.${children_names[i]}`

                let child_obj = Expressions.get_child_with_name(obj.children, name_to_find)

                if(child_obj){
                    // our new object to search is this child
                    obj = child_obj
                }else{
                    console.error(`could not find ${name_to_find}`)
                    return undefined
                }
            }
            return obj

        }else if (objs.length === 0){
            return undefined
        }else{
            console.error(`Somehow found multiple local gdb variables with the name ${top_level_var_name}. Not using any of them. File a bug report with the developer.`)
            return undefined
        }
    },
    keydown_on_input: function(e){
        if((e.keyCode === constants.ENTER_BUTTON_NUM)) {
            let expr = Expressions.el_input.val()
            if(_.trim(expr) !== ''){
                Expressions.create_variable(Expressions.el_input.val(), 'expr')
            }
        }
    },
    /**
     * Create a new variable in gdb. gdb automatically assigns
     * a unique variable name.
     */
    create_variable: function(expression, expr_type, ignore_errors=false){
        store.set('expr_being_created', expression)
        store.set('expr_type', expr_type)

        // - means auto assign variable name in gdb
        // * means evaluate it at the current frame
        if(expression.length > 0 && expression.indexOf('"') !== 0){
            expression = '"' + expression + '"'
        }
        let cmds = []
        if(store.get('pretty_print')){
            cmds.push('-enable-pretty-printing')
        }

        let var_create_cmd = `-var-create - * ${expression}`
        if(ignore_errors){
            var_create_cmd = constants.IGNORE_ERRORS_TOKEN_STR + var_create_cmd
        }
        cmds.push(var_create_cmd)

        GdbApi.run_gdb_command(cmds)
    },
    /**
     * gdb returns objects for its variables,, but before we save that
     * data locally, we will add more fields to make it more useful for gdbgui
     * @param obj (object): mi object returned from gdb
     * @param expr_type (str): type of expression being created (see store creation for documentation)
     */
    prepare_gdb_obj_for_storage: function(obj){
        let new_obj = $.extend(true, {}, obj)
        // obj was copied, now add some additional fields used by gdbgui

        // A varobj's contents may be provided by a Python-based pretty-printer.
        // In this case the varobj is known as a dynamic varobj.
        // Dynamic varobjs have slightly different semantics in some cases.
        // https://sourceware.org/gdb/onlinedocs/gdb/GDB_002fMI-Variable-Objects.html#GDB_002fMI-Variable-Objects
        new_obj.numchild = obj.dynamic ? parseInt(obj.has_more) : parseInt(obj.numchild)
        new_obj.children = []  // actual child objects are fetched dynamically when the user requests them
        new_obj.show_children_in_ui = false

        // this field is not returned when the variable is created, but
        // it is returned when the variables are updated
        // it is returned by gdb mi as a string, and we assume it starts out in scope
        new_obj.in_scope = 'true'
        new_obj.expr_type = store.get('expr_type')

        // can only be plotted if: value is an expression (not a local), and value is numeric
        new_obj.can_plot = (new_obj.expr_type === 'expr') && !window.isNaN(parseFloat(new_obj.value))
        new_obj.dom_id_for_plot = new_obj.name
            .replace(/\./g, '-')  // replace '.' with '-'
            .replace(/\$/g, '_')  // replace '$' with '-'
            .replace(/\[/g, '_')  // replace '[' with '_'
            .replace(/\]/g, '_')  // replace ']' with '_'
        new_obj.show_plot = false  // used when rendering to decide whether to show plot or not
        // push to this array each time a new value is assigned if value is numeric.
        // Plots use this data
        if(new_obj.value.indexOf('0x') === 0){
            new_obj.values = [parseInt(new_obj.value, 16)]
        }else if (!window.isNaN(parseFloat(new_obj.value))){
            new_obj.values = [new_obj.value]
        }else{
            new_obj.values = []
        }
        return new_obj
    },
    /**
     * After a variable is created, we need to link the gdb
     * variable name (which is automatically created by gdb),
     * and the expression the user wanted to evailuate. The
     * new variable is saved locally. The variable UI element is then re-rendered
     * @param r (object): gdb mi object
     */
    gdb_created_root_variable: function(r){
        let expr = store.get('expr_being_created')
        if(expr){
            // example payload:
            // "payload": {
            //      "has_more": "0",
            //      "name": "var2",
            //      "numchild": "0",
            //      "thread-id": "1",
            //      "type": "int",
            //      "value": "0"
            //  },
            Expressions.save_new_expression(expr, store.get('expr_type'), r.payload)
            store.set('expr_being_created', null)
            // automatically fetch first level of children for root variables
            Expressions.fetch_and_show_children_for_var(r.payload.name)
        }else{
            console.error('Developer error: gdb created a variable, but gdbgui did not expect it to.')
        }
    },
    /**
     * Got data regarding children of a gdb variable. It could be an immediate child, or grandchild, etc.
     * This method stores this child array data to the appropriate locally stored
     * object
     * @param r (object): gdb mi object
     */
    gdb_created_children_variables: function(r){
        // example reponse payload:
        // "payload": {
        //         "has_more": "0",
        //         "numchild": "2",
        //         "children": [
        //             {
        //                 "name": "var9.a",
        //                 "thread-id": "1",
        //                 "numchild": "0",
        //                 "value": "4195840",
        //                 "exp": "a",
        //                 "type": "int"
        //             },
        //             {
        //                 "name": "var9.b",
        //                 "thread-id": "1",
        //                 "numchild": "0",
        //                 "value": "0",
        //                 "exp": "b",
        //                 "type": "float"
        //             },
        //         ]
        //     }

        let parent_name = store.get('expr_gdb_parent_var_currently_fetching_children')

        store.set('expr_gdb_parent_var_currently_fetching_children', null)

        // get the parent object of these children
        let expressions = store.get('expressions')
        let parent_obj = Expressions.get_obj_from_gdb_var_name(expressions, parent_name)
        if(parent_obj){
            // prepare all the child objects we received for local storage
            let children = r.payload.children.map(child_obj => Expressions.prepare_gdb_obj_for_storage(child_obj))
            // save these children as a field to their parent
            parent_obj.children = children
            parent_obj.numchild = children.length
            store.set('expressions', expressions)
        }else{
            console.error('Developer error: gdb created a variable, but gdbgui did not expect it to.')
        }

        // if this field is an anonymous struct, the user will want to
        // see this expanded by default
        for(let child of parent_obj.children){
            if (child.exp.includes('anonymous')){
                Expressions.fetch_and_show_children_for_var(child.name)
            }
        }
    },
    render: function(reactor){
        let html = ''
        const is_root = true

        let sorted_expression_objs = _.sortBy(store.get('expressions'), unsorted_obj => unsorted_obj.expression)
        // only render variables in scope that were not created for the Locals component
        , objs_to_render = sorted_expression_objs.filter(obj => obj.in_scope === 'true' && obj.expr_type === 'expr')
        , objs_to_delete = sorted_expression_objs.filter(obj => obj.in_scope === 'invalid')

        // delete invalid objects
        objs_to_delete.map(obj => Expressions.delete_gdb_variable(obj.name))

        for(let obj of objs_to_render){
            if(obj.numchild > 0) {
                html += Expressions.get_ul_for_var_with_children(obj.expression, obj, is_root, true)
            }else{
                html += Expressions.get_ul_for_var_without_children(obj.expression, obj, is_root, true)
            }
        }
        if(html === ''){
            html = '<span class=placeholder>no expressions in this context</span>'
        }
        html += '<div id=tooltip style="display: hidden"/>'

        reactor.objs_to_render = objs_to_render
        reactor.force_update = true
        return html
    },
    after_render: function(reactor){
        for(let obj of reactor.objs_to_render){
            Expressions.plot_var_and_children(obj)
        }
    },
    /**
     * function render a plot on an existing element
     * @param obj: object to make a plot for
     */
    _make_plot: function(obj){
        let id = '#' + obj.dom_id_for_plot  // this div should have been created already
        , jq = $(id)
        , data = []
        , i = 0

        // collect data
        for(let val of obj.values){
            data.push([i, val])
            i++
        }

        // make the plot
        $.plot(jq,
            [
                {data: data,
                shadowSize: 0,
                color: '#33cdff'}
            ],
            {
                series: {
                    lines: { show: true },
                    points: { show: true }
                },
                grid: { hoverable: true, clickable: false }
            }
        )

        // add hover event to show tooltip
        jq.bind('plothover', function (event, pos, item) {
            if (item) {
                let x = item.datapoint[0]
                , y = item.datapoint[1]

                $('#tooltip').html(`(${x}, ${y})`)
                    .css({top: item.pageY+5, left: item.pageX+5})
                    .show()
            } else {
                $("#tooltip").hide();
            }
        })
    },
    /**
     * look through all expression objects and see if they are supposed to show their plot.
     * If so, update the dom accordingly
     * @param obj: expression object to plot (may have children to plot too)
     */
    plot_var_and_children: function(obj){
        if(obj.show_plot){
            Expressions._make_plot(obj)
        }
        for(let child of obj.children){
            Expressions.plot_var_and_children(child)
        }
    },
    /**
     * get unordered list for a variable that has children
     * @return unordered list, expanded or collapsed based on the key "show_children_in_ui"
     */
    get_ul_for_var_with_children: function(expression, mi_obj, is_root=false){
        let child_tree = ''
        if(mi_obj.show_children_in_ui){
            child_tree = '<ul>'
            if(mi_obj.children.length > 0){
                for(let child of mi_obj.children){
                    if(child.numchild > 0){
                        child_tree += `<li>${Expressions.get_ul_for_var_with_children(child.exp, child)}</li>`
                    }else{
                        child_tree += `<li>${Expressions.get_ul_for_var_without_children(child.exp, child)}</li>`
                    }
                }
            }else{
                child_tree += `<li>${constants.ANIMATED_REFRESH_ICON}</li>`
            }

            child_tree += '</ul>'
        }

        let plus_or_minus = mi_obj.show_children_in_ui ? '-' : '+'
        return Expressions._get_ul_for_var(expression, mi_obj, is_root, plus_or_minus, child_tree, mi_obj.numchild)
    },
    get_ul_for_var_without_children: function(expression, mi_obj, is_root=false){
        return Expressions._get_ul_for_var(expression, mi_obj, is_root)
    },
    /**
     * Get ul for a variable with or without children
     */
    _get_ul_for_var: function(expression, mi_obj, is_root, plus_or_minus='', child_tree='', numchild=0){
        let
            delete_button = is_root ? `<span class='glyphicon glyphicon-trash delete_gdb_variable pointer' data-gdb_variable='${mi_obj.name}' />` : ''
            , tree = numchild > 0 ? `<span class='glyphicon glyphicon-tree-deciduous draw_tree_gdb_variable pointer' data-gdb_variable='${mi_obj.name}' />` : ''
            , toggle_classes = numchild > 0 ? 'toggle_children_visibility pointer' : ''
            , val = _.isString(mi_obj.value) ? Memory.make_addrs_into_links(mi_obj.value) : mi_obj.value
            , plot_content = ''
            , plot_button = ''

        if(mi_obj.can_plot && mi_obj.show_plot){
            // dots are not allowed in the dom as id's. replace with '-'.
            let id = mi_obj.dom_id_for_plot
            plot_button = `<span class='toggle_plot pointer glyphicon glyphicon-ban-circle' data-gdb_variable_name='${mi_obj.name}' title='remove plot'></span>`
            plot_content = `<div id='${id}' class=plot />`

        }else if(mi_obj.can_plot && !mi_obj.show_plot){
            plot_button = `<img src='/static/images/ploticon.png' class='toggle_plot pointer' data-gdb_variable_name='${mi_obj.name}' />`
        }

        return `<ul class='variable'>
            <li>
                <span class='${toggle_classes}' data-gdb_variable_name='${mi_obj.name}'>
                    ${plus_or_minus} ${Util.escape(expression)}:
                </span>

                ${val}

                <span class='var_type'>
                    ${Util.escape(mi_obj.type || '')}
                </span>


                <div class='right_help_icon_show_on_hover'>
                    ${tree}
                    ${plot_button}
                    ${delete_button}
                </div>

                ${plot_content}

            </li>
            ${child_tree}
        </ul>
        `
    },
    fetch_and_show_children_for_var: function(gdb_var_name){
        let expressions = store.get('expressions')
        let obj = Expressions.get_obj_from_gdb_var_name(expressions, gdb_var_name)
        // mutate object by reference
        obj.show_children_in_ui = true
        // update store
        store.set('expressions', expressions)
        if((obj.numchild) && obj.children.length === 0){
            // need to fetch child data
            Expressions._get_children_for_var(gdb_var_name, obj.expr_type)
        }else{
            // already have child data, re-render will occur from event dispatch
        }
    },
    hide_children_in_ui: function(gdb_var_name){
        let expressions = store.get('expressions')
        , obj = Expressions.get_obj_from_gdb_var_name(expressions, gdb_var_name)
        if(obj){
            obj.show_children_in_ui = false
            store.set('expressions', expressions)
        }
    },
    click_toggle_children_visibility: function(e){
        Expressions._toggle_children_visibility(e.currentTarget.dataset.gdb_variable_name)
    },
    _toggle_children_visibility(gdb_var_name){
        // get data object, which has field that says whether its expanded or not
        let obj = Expressions.get_obj_from_gdb_var_name(store.get('expressions'), gdb_var_name)
        , showing_children_in_ui = obj.show_children_in_ui

        if(showing_children_in_ui){
            // collapse
            Expressions.hide_children_in_ui(gdb_var_name)
        }else{
            // expand
            Expressions.fetch_and_show_children_for_var(gdb_var_name)
        }
    },
    click_toggle_plot: function(e){
        let gdb_var_name = e.currentTarget.dataset.gdb_variable_name
        , expressions = store.get('expressions')
        // get data object, which has field that says whether its expanded or not
        , obj = Expressions.get_obj_from_gdb_var_name(expressions, gdb_var_name)
        obj.show_plot = !obj.show_plot
        store.set('expressions', expressions)
    },
    /**
     * Send command to gdb to give us all the children and values
     * for a gdb variable. Note that the gdb variable itself may be a child.
     */
    _get_children_for_var: function(gdb_variable_name, expr_type){
        store.set('expr_gdb_parent_var_currently_fetching_children', gdb_variable_name)
        store.set('expr_type', expr_type)
        GdbApi.run_gdb_command(`-var-list-children --all-values "${gdb_variable_name}"`)
    },
    get_update_cmds: function(){
        function _get_cmds_for_obj(obj){
            let cmds = [`-var-update --all-values ${obj.name}`]
            for(let child of obj.children){
                cmds = cmds.concat(_get_cmds_for_obj(child))
            }
            return cmds
        }

        let cmds = []
        for(let obj of store.get('expressions')){
            cmds = cmds.concat(_get_cmds_for_obj(obj))
        }
        return cmds
    },
    handle_changelist: function(changelist_array){
        for(let changelist of changelist_array){
            let expressions = store.get('expressions')
            , obj = Expressions.get_obj_from_gdb_var_name(expressions, changelist.name)
            if(obj){
                if(parseInt(changelist['has_more']) === 1 && 'name' in changelist){
                    // already retrieved children of obj, but more fields were added.
                    // Re-fetch the object from gdb
                    Expressions._get_children_for_var(changelist['name'], obj.expr_type)
                }
                if('new_children' in changelist){
                    let new_children = changelist.new_children.map(child_obj => Expressions.prepare_gdb_obj_for_storage(child_obj))
                    obj.children = obj.children.concat(new_children)
                }
                if('value' in changelist && obj.expr_type === 'expr'){
                    // this object is an expression and it had a value updated.
                    // save the value to an array for plotting
                    if(changelist.value.indexOf('0x') === 0){
                        obj.can_plot = true
                        obj.values.push(parseInt(changelist.value, 16))
                    }else if (!window.isNaN(parseFloat(changelist.value))){
                        obj.can_plot = true
                        obj.values.push(changelist.value)
                    }
                }
                // overwrite fields of obj with fields from changelist
                _.assign(obj, changelist)
                // update expressions array which will trigger and event, which will
                // cause components to re-render
                store.set('expressions', expressions)
            }else{
                // error
            }
        }
    },
    click_delete_gdb_variable: function(e){
        e.stopPropagation() // not sure if this is still needed
        Expressions.delete_gdb_variable(e.currentTarget.dataset.gdb_variable)
    },
    click_draw_tree_gdb_variable: function(e){
        e.stopPropagation() // not sure if this is still needed
        store.set('root_gdb_tree_var', e.currentTarget.dataset.gdb_variable)
    },
    delete_gdb_variable: function(gdbvar){
        // delete locally
        Expressions._delete_local_gdb_var_data(gdbvar)
        // delete in gdb too
        GdbApi.run_gdb_command(`-var-delete ${gdbvar}`)
    },
    /**
     * Delete local copy of gdb variable (all its children are deleted too
     * since they are stored as fields in the object)
     */
    _delete_local_gdb_var_data: function(gdb_var_name){
        let expressions = store.get('expressions')
        _.remove(expressions, v => v.name === gdb_var_name)
        store.set('expressions', expressions)
    },
}

const Locals = {
    init: function(){
        new Reactor('#locals', Locals.render)

        window.addEventListener('event_inferior_program_exited', Locals.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', Locals.event_inferior_program_running)

        $('body').on('click', '.locals_autocreate_new_expr', Locals.click_locals_autocreate_new_expr)
    },
    render: function(){
        if(store.get('locals').length === 0){
            return '<span class=placeholder>no variables to display</span>'
        }
        let sorted_local_objs = _.sortBy(store.get('locals'), unsorted_obj => unsorted_obj.name)
        let html = sorted_local_objs.map(local => {
            let obj = Locals.get_autocreated_obj_from_expr(local.name)
            if(obj){
                let expr = local.name
                , is_root = true
                if(obj.numchild > 0){
                    return Expressions.get_ul_for_var_with_children(expr, obj, is_root)
                }else{
                    return Expressions.get_ul_for_var_without_children(expr, obj, is_root)
                }

            }else{
                // turn hex addresses into links to view memory

                let value = ''
                , plus_or_minus
                , cls

                if('value' in local){
                    value = Memory.make_addrs_into_links(local.value)
                    plus_or_minus = local.type.indexOf('*') !== -1  ? '+' : ''// make plus if value is a pointer (has asterisk)
                }else{
                    // this is not a simple type, so no value was returned. Display the plus to indicate
                    // it can be clicked (which will autocreate and expression that populates the fields)
                    plus_or_minus = '+'
                }

                if(plus_or_minus === '+'){
                    cls = 'locals_autocreate_new_expr pointer'
                }


                // return local variable name, value (if available), and type
                    return  `
                        <span class='${cls}' data-expression='${local.name}'>
                            ${plus_or_minus} ${local.name}: ${value}
                        </span>
                        <span class='var_type'>
                            ${_.trim(local.type)}
                        </span>
                        <br>
                        `
            }

        })
        return html.join('')
    },
    click_locals_autocreate_new_expr: function(e){
        let expr = e.currentTarget.dataset.expression
        if(expr){
            Expressions.create_variable(expr, 'local')
        }
    },
    get_autocreated_obj_from_expr: function(expr){
        for(let obj of store.get('expressions')){
            if(obj.expression === expr && obj.expr_type === 'local'){
                return obj
            }
        }
        return null
    },
    clear_autocreated_exprs: function(){
        let exprs_objs_to_remove = store.get('expressions').filter(obj => obj.expr_type === 'local')
        exprs_objs_to_remove.map(obj => Expressions.delete_gdb_variable(obj.name))
    },
    clear: function(){
        Locals.clear_autocreated_exprs()
    },
    event_inferior_program_exited: function(){
        Locals.clear()
    },
    event_inferior_program_running: function(){
        Locals.clear()
    },
}

const HoverVar = {
    init: function(){
        $('body').on('mouseover', '#code_table span.n', HoverVar.mouseover_variable)
        $('body').on('mouseover', '#code_table span.nx', HoverVar.mouseover_variable)
        $('body').on('mouseenter', '#hovervar', HoverVar.mouseover_hover_window)
        $('body').on('mouseleave', '#code_table span.n', HoverVar.mouseout_variable)
        $('body').on('mouseleave', '#code_table span.nx', HoverVar.mouseout_variable)
        $('body').on('mouseleave', '#hovervar', HoverVar.mouseout_hover_window)
        new Reactor('#hovervar', HoverVar.render, {after_dom_update: HoverVar.after_dom_update})
    },
    enter_timeout: undefined,  // debounce fetching the expression
    exit_timeout: undefined,  // debounce removing the box
    left: 0,
    top: 0,
    mouseover_variable: function(e){
        HoverVar.clear_hover_state()

        let rect = e.target.getBoundingClientRect()
        , var_name = e.target.textContent

        // store coordinates of where the box should be displayed
        HoverVar.left = rect.left
        HoverVar.top = rect.bottom

        const WAIT_TIME_SEC = 0.5
        HoverVar.enter_timeout = setTimeout(
            ()=>{
                let program_stopped = store.get('stack').length > 0
                if(program_stopped){
                    let ignore_errors = true
                    Expressions.create_variable(var_name, 'hover', ignore_errors)
                }
            },
            WAIT_TIME_SEC * 1000)
    },
    mouseout_variable: function(e){
        void(e)
        const WAIT_TIME_SEC = 0.1
        HoverVar.exit_timeout = setTimeout(
            ()=>{
                HoverVar.clear_hover_state()
            },
            WAIT_TIME_SEC * 1000
        )
    },
    mouseover_hover_window: function(e){
        void(e)
        // Mouse went from hovering over variable name in source code to
        // hovering over the window showing the contents of the variable.
        // Don't remove the window in this case.
        clearTimeout(HoverVar.exit_timeout)
    },
    mouseout_hover_window: function(e){
        void(e)
        HoverVar.clear_hover_state()
    },
    clear_hover_state: function(){
        clearTimeout(HoverVar.enter_timeout)
        clearTimeout(HoverVar.exit_timeout)
        let exprs_objs_to_remove = store.get('expressions').filter(obj => obj.expr_type === 'hover')
        exprs_objs_to_remove.map(obj => Expressions.delete_gdb_variable(obj.name))
    },
    render: function(r){
        void(r)
        let hover_objs = store.get('expressions').filter(o => o.expr_type === 'hover')
        , obj
        if(Array.isArray(hover_objs) && hover_objs.length === 1){
            obj = hover_objs[0]
        }
        HoverVar.obj = obj
        if (obj){
            let is_root = true
            if(obj.numchild > 0){
                return Expressions.get_ul_for_var_with_children(obj.expression, obj, is_root)
            }else{
                return Expressions.get_ul_for_var_without_children(obj.expression, obj, is_root)
            }
        }else{
            return 'no variable hovered'
        }
    },
    after_dom_update: function(r){
        if(HoverVar.obj){
            r.node.style.left = HoverVar.left + 'px'
            r.node.style.top = HoverVar.top + 'px'
            r.node.classList.remove('hidden')
        }else{
            r.node.classList.add('hidden')
        }

    }
}

module.exports = {
    Expressions: Expressions,
    Locals: Locals,
    HoverVar: HoverVar
}
