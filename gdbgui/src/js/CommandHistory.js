// object to store array of sent commands, as well as ability
// to scroll through old commands by maintaining state

let initial_sent_cmds = []
try{
    initial_sent_cmds = JSON.parse(localStorage.getItem('sent_cmds')) || []
}catch(err){
    initial_sent_cmds = []
}

if(!_.isArray(initial_sent_cmds)){
    initial_sent_cmds = []
}

const CommandHistory = {
    index: null,
    sent_cmds: initial_sent_cmds,
    is_history_being_used: false,
    COMMAND_HISTORY_LIMIT: 500,

    // up arrow in console triggers this - go to end of array and move toward index 0
    get_previous_command: function(){
        // start at the end if history is not being cycled through
        CH.index = CH.is_history_being_used ? CH.index - 1 : CH.sent_cmds.length - 1
        CH.is_history_being_used = true
        if(CH.index < 0){
            CH.index = 0
            return null
        }

        return CH.sent_cmds[CH.index]
    },

    // down arrow in console triggers this - go to beginning of array and move toward last index
    get_next_command: function(){
        // start at the beginning if history is not being cycled through
        CH.index = CH.is_history_being_used ? CH.index + 1 : 0
        if (CH.index > (CH.sent_cmds.length)){
            CH.index = CH.sent_cmds.length
            return null
        }

        CH.is_history_being_used = true
        if(CH.index >= CH.sent_cmds.length){
            return null
        }

        return CH.sent_cmds[CH.index]
    },
    add_command: function(command){
        CH.reset()
        if(CH.sent_cmds.indexOf(command) !== -1){
            // don't add duplicate commands
            return
        }
        if(CH.sent_cmds.length > CH.COMMAND_HISTORY_LIMIT){
            // remove a command so we stay under the limit
            CH.sent_cmds.shift()
        }

        CH.sent_cmds.push(command)
        localStorage.setItem('sent_cmds', JSON.stringify(CH.sent_cmds))
    },

    reset: function(){
        CH.is_history_being_used = false
        CH.index = 0
    },
}
let CH = CommandHistory

export default CommandHistory
