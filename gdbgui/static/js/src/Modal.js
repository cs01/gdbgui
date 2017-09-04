/**
 * Modal component that is hidden by default, but shown
 * when render is called. The user must close the modal to
 * resume using the GUI.
 */
const Modal = {
    init: function(){
        $('#gdb_modal').on('hidden.bs.modal', function () {
            $('main').removeClass('blur') // unblur the main content
        })

    },
    /**
     * Call when an important modal message must be shown
     */
    render: function(title, body){
        $('#modal_title').html(title)
        $('#modal_body').html(body)
        $('#gdb_modal').modal('show')
        $('main').addClass('blur')  // blur the main content
    }
}

export default Modal
