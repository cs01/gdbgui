import {store, Reactor} from './store.js';
import GdbApi from './GdbApi.js';
import Util from './Util.js';

const ENTER_BUTTON_NUM = 13

/**
 * The Memory component allows the user to view
 * data stored at memory locations
 */
const Memory = {
    el: $('#memory'),
    el_start: $('#memory_start_address'),
    el_end: $('#memory_end_address'),
    el_bytes_per_line: $('#memory_bytes_per_line'),
    MAX_ADDRESS_DELTA_BYTES: 1000,
    DEFAULT_ADDRESS_DELTA_BYTES: 31,
    init: function(){
        new Reactor('#memory', Memory.render)

        $("body").on("click", ".memory_address", Memory.click_memory_address)
        $("body").on("click", "#read_preceding_memory", Memory.click_read_preceding_memory)
        $("body").on("click", "#read_more_memory", Memory.click_read_more_memory)
        Memory.el_start.keydown(Memory.keydown_in_memory_inputs)
        Memory.el_end.keydown(Memory.keydown_in_memory_inputs)
        Memory.el_bytes_per_line.keydown(Memory.keydown_in_memory_inputs)

        window.addEventListener('event_inferior_program_exited', Memory.event_inferior_program_exited)
        window.addEventListener('event_inferior_program_running', Memory.event_inferior_program_running)
        window.addEventListener('event_inferior_program_paused', Memory.event_inferior_program_paused)
    },
    keydown_in_memory_inputs: function(e){
        if (e.keyCode === ENTER_BUTTON_NUM){
            Memory.fetch_memory_from_inputs()
        }
    },
    click_memory_address: function(e){
        e.stopPropagation()

        let addr = e.currentTarget.dataset['memory_address']
        // set inputs in DOM
        Memory.el_start.val('0x' + (parseInt(addr, 16)).toString(16))
        Memory.el_end.val('0x' + (parseInt(addr,16) + Memory.DEFAULT_ADDRESS_DELTA_BYTES).toString(16))

        // fetch memory from whatever's in DOM
        Memory.fetch_memory_from_inputs()
    },
    get_gdb_commands_from_inputs: function(){
        let start_addr = parseInt(_.trim(Memory.el_start.val()), 16),
            end_addr = parseInt(_.trim(Memory.el_end.val()), 16)

        if(!window.isNaN(start_addr) && window.isNaN(end_addr)){
            end_addr = start_addr + Memory.DEFAULT_ADDRESS_DELTA_BYTES
        }

        let cmds = []
        if(_.isInteger(start_addr) && end_addr){
            if(start_addr > end_addr){
                end_addr = start_addr + Memory.DEFAULT_ADDRESS_DELTA_BYTES
                Memory.el_end.val('0x' + end_addr.toString(16))
            }else if((end_addr - start_addr) > Memory.MAX_ADDRESS_DELTA_BYTES){
                end_addr = start_addr + Memory.MAX_ADDRESS_DELTA_BYTES
                Memory.el_end.val('0x' + end_addr.toString(16))
            }

            let cur_addr = start_addr
            while(cur_addr <= end_addr){
                cmds.push(`-data-read-memory-bytes ${'0x' + cur_addr.toString(16)} 1`)
                cur_addr = cur_addr + 1
            }
        }

        if(!window.isNaN(start_addr)){
            Memory.el_start.val('0x' + start_addr.toString(16))
        }
        if(!window.isNaN(end_addr)){
            Memory.el_end.val('0x' + end_addr.toString(16))
        }

        return cmds
    },
    fetch_memory_from_inputs: function(){
        let cmds = Memory.get_gdb_commands_from_inputs()
        Memory.clear_cache()
        GdbApi.run_gdb_command(cmds)
    },
    click_read_preceding_memory: function(){
        // update starting value, then re-fetch
        let NUM_ROWS = 3
        let start_addr = parseInt(_.trim(Memory.el_start.val()), 16)
        , byte_offset = Memory.el_bytes_per_line.val() * NUM_ROWS
        Memory.el_start.val('0x' + (start_addr - byte_offset).toString(16))
        Memory.fetch_memory_from_inputs()
    },
    click_read_more_memory: function(){
        // update ending value, then re-fetch
        let NUM_ROWS = 3
        let end_addr = parseInt(_.trim(Memory.el_end.val()), 16)
        , byte_offset = Memory.el_bytes_per_line.val() * NUM_ROWS
        Memory.el_end.val('0x' + (end_addr + byte_offset).toString(16))
        Memory.fetch_memory_from_inputs()
    },
    /**
     * Internal render function. Not called directly to avoid wasting DOM cycles
     * when memory is being received from gdb at a high rate.
     */
    render: function(){
        if(_.keys(store.get('memory_cache')).length === 0){
            return '<span class=placeholder>no memory to display</span>'
        }

        let data = []
        , hex_vals_for_this_addr = []
        , char_vals_for_this_addr = []
        , i = 0
        , hex_addr_to_display = null

        let bytes_per_line = (parseInt(Memory.el_bytes_per_line.val())) || 8
        bytes_per_line = Math.max(bytes_per_line, 1)
        $('#memory_bytes_per_line').val(bytes_per_line)

        if(Object.keys(store.get('memory_cache')).length > 0){
            data.push(['<span id=read_preceding_memory class=pointer style="font-style:italic; font-size: 0.8em;">more</span>',
                        '',
                        '']
            )
        }

        for (let hex_addr in store.get('memory_cache')){
            if(!hex_addr_to_display){
                hex_addr_to_display = hex_addr
            }

            if(i % (bytes_per_line) === 0 && hex_vals_for_this_addr.length > 0){
                // begin new row
                data.push([Memory.make_addrs_into_links(hex_addr_to_display),
                    hex_vals_for_this_addr.join(' '),
                    char_vals_for_this_addr.join(' ')])

                // update which address we're collecting values for
                i = 0
                hex_addr_to_display = hex_addr
                hex_vals_for_this_addr = []
                char_vals_for_this_addr = []

            }
            let hex_value = store.get('memory_cache')[hex_addr]
            hex_vals_for_this_addr.push(hex_value)
            let char = String.fromCharCode(parseInt(hex_value, 16)).replace(/\W/g, '.')
            char_vals_for_this_addr.push(`<span class='memory_char'>${char}</span>`)
            i++

        }

        if(hex_vals_for_this_addr.length > 0){
            // memory range requested wasn't divisible by bytes per line
            // add the remaining memory
            data.push([Memory.make_addrs_into_links(hex_addr_to_display),
                    hex_vals_for_this_addr.join(' '),
                    char_vals_for_this_addr.join(' ')])

        }

        if(Object.keys(store.get('memory_cache')).length > 0){
            data.push(['<span id=read_more_memory class=pointer style="font-style:italic; font-size: 0.8em;">more</span>',
                        '',
                        '']
            )
        }

        let table = Util.get_table(['address', 'hex' , 'char'], data)
        return table
    },
    _make_addr_into_link: function(addr, name=addr){
        let _addr = addr
            , _name = name
        return `<a class='pointer memory_address' data-memory_address='${_addr}'>${_name}</a>`
    },
    /**
     * Scan arbitrary text for addresses, and turn those addresses into links
     * that can be clicked in gdbgui
     */
    make_addrs_into_links: function(text, name=undefined){
        return text.replace(/(0x[\d\w]+)/g, Memory._make_addr_into_link('$1', name))
    },
    add_value_to_cache: function(hex_str, hex_val){
        // strip leading zeros off address provided by gdb
        // i.e. 0x000123 turns to
        // 0x123
        let hex_str_truncated = '0x' + (parseInt(hex_str, 16)).toString(16)
        let cache = store.get('memory_cache')
        cache[hex_str_truncated] = hex_val
        store.set('memory_cache', cache)
    },
    clear_cache: function(){
        store.set('memory_cache', {})
    },
    event_inferior_program_exited: function(){
        Memory.clear_cache()
    },
    event_inferior_program_running: function(){
        Memory.clear_cache()
    },
    event_inferior_program_paused: function(){
        // Memory.render()
    },
}

export default Memory
