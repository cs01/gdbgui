from gdbgui.server import sessionmanager


def test_SessionManager():
    manager = sessionmanager.SessionManager()
    db_session = manager.add_new_debug_session(
        gdb_command="gdb", mi_version="mi3", client_id="test"
    )
    pid = manager.get_pid_from_debug_session(db_session)
    assert pid
    dashboard_data = manager.get_dashboard_data()
    assert len(dashboard_data) == 1
