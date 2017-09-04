import {store, Reactor} from './store.js';
import Modal from './Modal.js';

/**
 * Settings modal when clicking the gear icon
 */
const Settings = {
    el: $('#gdbgui_settings_button'),
    pane: $('#settings_container'),
    menudropdown: $('#menudropdown'),
    init: function(){
        new Reactor('#settings_body', Settings.render)

        $('body').on('change', '#theme_selector', Settings.theme_selection_changed)
        $('body').on('change', '#syntax_highlight_selector', Settings.syntax_highlight_selector_changed)
        $('body').on('change', '#checkbox_auto_add_breakpoint_to_main', Settings.checkbox_auto_add_breakpoint_to_main_changed)
        $('body').on('change', '#pretty_print', Settings.update_state_from_checkbox_and_id)  // id must match existing key in store
        $('body').on('change', '#refresh_state_after_sending_console_command', Settings.update_state_from_checkbox_and_id)  // id must match existing key in store
        $('body').on('change', '#show_all_sent_commands_in_console', Settings.update_state_from_checkbox_and_id)  // id must match existing key in store
        $('body').on('click', '.toggle_settings_view', Settings.click_toggle_settings_view)


        // Fetch the latest version only if using in normal mode. If debugging, we tend to
        // refresh quite a bit, which might make too many requests to github and cause them
        // to block our ip? Either way it just seems weird to make so many ajax requests.
        if(!store.get('debug')){
            // fetch version
            $.ajax({
                url: "https://raw.githubusercontent.com/cs01/gdbgui/master/gdbgui/VERSION.txt",
                cache: false,
                method: 'GET',
                success: (data) => {
                    store.set('latest_gdbgui_version', _.trim(data))

                    if(Settings.needs_to_update_gdbgui_version() && store.get('show_gdbgui_upgrades')){
                        Modal.render(`Update Available`, Settings.get_upgrade_text())
                    }
                },
                error: (data) => {
                    void(data)
                    store.set('latest_gdbgui_version', '(could not contact server)')
                },
            })
        }
    },
    needs_to_update_gdbgui_version: function(){
        return store.get('latest_gdbgui_version') !== store.get('gdbgui_version')
    },
    get_upgrade_text: function(){
        if(Settings.needs_to_update_gdbgui_version()){
            return `gdbgui version ${store.get('latest_gdbgui_version')} is available. You are using ${store.get('gdbgui_version')}.
            <p><p>
            To upgrade, run<p>
            <span class='monospace bold'>[sudo] pip install gdbgui --upgrade</span><p>
            or see <a href='https://github.com/cs01/gdbgui/blob/master/INSTALLATION.md'>installation instructions</a> for more detailed instructions.
            <p><p>
            <a href='https://github.com/cs01/gdbgui/blob/master/CHANGELOG.md'>View changelog</a>
            `
        }else{
            return `gdbgui version ${store.get('gdbgui_version')} (latest version)`
        }
    },
    render: function(){
        let theme_options = ''
        , current_theme = store.get('current_theme')

        for(let theme of store.get('themes')){
            if(theme === current_theme){
                theme_options += `<option selected value=${theme}>${theme}</option>`
            }else{
                theme_options += `<option value=${theme}>${theme}</option>`
            }
        }

        return `<table class='table table-condensed'>
            <tbody>
            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=checkbox_auto_add_breakpoint_to_main type='checkbox' ${store.get('auto_add_breakpoint_to_main') ? 'checked' : ''}>
                        Auto add breakpoint to main
                    </label>
                </div>

            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=pretty_print type='checkbox' ${store.get('pretty_print') ? 'checked' : ''}>
                        Pretty print dynamic variables (shows human readable values rather than internal methods)
                    </label>
                </div>

            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=refresh_state_after_sending_console_command type='checkbox' ${store.get('refresh_state_after_sending_console_command') ? 'checked' : ''}>
                        Refresh store after sending command from the console widget
                    </label>
                </div>


            <tr><td>
                <div class=checkbox>
                    <label>
                        <input id=show_all_sent_commands_in_console type='checkbox' ${store.get('show_all_sent_commands_in_console') ? 'checked' : ''}>
                        Show all sent commands in console
                    </label>
                </div>

            <tr><td>
                Theme: <select id=theme_selector>${theme_options}</select>

            <tr><td>
                Syntax Highlighting:
                    <select id=syntax_highlight_selector>
                        <option value='on' ${store.get('highlight_source_code') === true ? 'selected' : ''} >on</option>
                        <option value='off' ${store.get('highlight_source_code') === false ? 'selected' : ''} >off</option>
                    </select>
                     (better performance for large files when off)

            <tr><td>
                gdb version: ${store.get('gdb_version')}

            <tr><td>
                gdb pid for this tab: ${store.get('gdb_pid')}

            <tr><td>
                ${Settings.get_upgrade_text()}

            <tr><td>
            a <a href='http://grassfedcode.com'>grassfedcode</a> project | <a href=https://github.com/cs01/gdbgui>github</a> | <a href=https://pypi.python.org/pypi/gdbgui>pyPI</a> | <a href='https://www.youtube.com/channel/UCUCOSclB97r9nd54NpXMV5A'>YouTube</a>
            `
    },
    click_toggle_settings_view: function(e){
        if(e.target.classList.contains('toggle_settings_view')){  // need this check in case background div has this class
            e.stopPropagation()  // need this to prevent toggling twice rapidly if a toggle button is over a div
            Settings.pane.toggleClass('hidden')
            $('main').toggleClass('blur')
            Settings.menudropdown.removeClass('open')
        }
    },
    theme_selection_changed: function(e){
        store.set('current_theme', e.currentTarget.value)
        localStorage.setItem('theme', e.currentTarget.value)
    },
    syntax_highlight_selector_changed: function(e){
        // update preference in store
        store.set('highlight_source_code', e.currentTarget.value === 'on')
        // remove all cached source files, since the cache contains syntax highlighting, or is lacking it
        store.set('cached_source_files', [])
        store.set('rendered_source_file_fullname', null)
        // save preference for later
        localStorage.setItem('highlight_source_code', JSON.stringify(store.get('highlight_source_code')))
    },
    checkbox_auto_add_breakpoint_to_main_changed: function(){
        let checked = $('#checkbox_auto_add_breakpoint_to_main').prop('checked')
        store.set('auto_add_breakpoint_to_main', checked)
        localStorage.setItem('auto_add_breakpoint_to_main', JSON.stringify(store.get('auto_add_breakpoint_to_main')))
    },
    update_state_from_checkbox_and_id: function(e){
        let key = e.target.id  // must be an existing key in store
        , checked = e.target.checked
        store.set(key, checked)
    },
}

export default Settings
