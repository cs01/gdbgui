from . import test_app, static_tests

exit(test_app.main() + static_tests.main())
