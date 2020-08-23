from flask import Blueprint, render_template, request, session, jsonify
from .constants import TEMPLATE_DIR, SIGNAL_NAME_TO_OBJ, USING_WINDOWS
from gdbgui import __version__

blueprint = Blueprint("http_routes", __name__, template_folder=TEMPLATE_DIR)


@blueprint.route("/remove_gdb_controller", methods=["POST"])
def remove_gdb_controller():
    gdbpid = int(request.form.get("gdbpid"))

    orphaned_client_ids = manager.remove_debug_session_by_pid(gdbpid)
    num_removed = len(orphaned_client_ids)

    send_msg_to_clients(
        orphaned_client_ids,
        "The underlying gdb process has been killed. This tab will no longer function as expected.",
        error=True,
    )

    msg = "removed %d gdb controller(s) with pid %d" % (num_removed, gdbpid)
    if num_removed:
        return jsonify({"message": msg})

    else:
        return jsonify({"message": msg}), 500
