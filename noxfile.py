import nox  # type: ignore
from pathlib import Path


nox.options.sessions = ["tests", "lint", "docs"]
python = ["3.6", "3.7", "3.8"]


doc_dependencies = [".", "mkdocs", "mkdocs-material"]
lint_dependencies = ["black", "flake8", "mypy", "check-manifest"]


@nox.session(python=python)
def tests(session):
    session.install(".")
    session.run("python", "-m", "unittest", "discover")
    session.run("yarn", "install", external=True)
    session.run("yarn", "test", external=True)
    session.run("yarn", "build", external=True)


@nox.session(python="3.7")
def lint(session):
    session.run(
        "npx",
        "prettier",
        "--check",
        "--config",
        ".prettierrc.js",
        "gdbgui/src/js/**/*",
        external=True,
    )
    session.install(*lint_dependencies)
    files = ["gdbgui", "tests"] + [str(p) for p in Path(".").glob("*.py")]
    session.run("black", "--check", *files)
    session.run("flake8", *files)
    session.run("mypy", *files)  #
    session.run(
        "check-manifest",
        "--ignore",
        "build.js,gdbgui/static/js,gdbgui/static/js/build.js.map",
    )
    session.run("python", "setup.py", "check", "--metadata", "--strict")


@nox.session(python="3.7")
def docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "build")


@nox.session(python=python)
def develop(session):
    session.install(*doc_dependencies, *lint_dependencies)
    session.install("-e", ".")
    command = "source %s/bin/activate" % (session.virtualenv.location_name)
    session.log("Virtual Envrionment is ready to be used for development")
    session.log("To use, run: '%s'", command)


@nox.session(python="3.7")
def build(session):
    session.install("setuptools", "wheel", "twine")
    session.run("rm", "-rf", "dist", external=True)
    session.run("yarn", "build")
    session.run("python", "setup.py", "--quiet", "sdist", "bdist_wheel")
    session.run("twine", "check", "dist/*")


@nox.session(python="3.7")
def publish(session):
    build(session)
    print("REMINDER: Has the changelog been updated?")
    session.run("python", "-m", "twine", "upload", "dist/*")


@nox.session(python="3.7")
def watch_docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "serve")


@nox.session(python="3.7")
def publish_docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "gh-deploy")


@nox.session(python="3.7")
def docker_executables(session):
    session.install("PyInstaller==3.3.1")
    # Windows
    session.run(
        "docker", "build", "-t", "gdbgui_windows", "docker/windows", external=True
    )
    session.run("docker", "run", "-v", '"`pwd`:/src/"', "gdbgui_windows", external=True)

    # linux
    session.run("docker", "build", "-t", "gdbgui_linux", "docker/linux", external=True)
    session.run("docker", "run", "-v", '"`pwd`:/src/"', "gdbgui_linux", external=True)


@nox.session(python="3.7")
def build_executable_current_os(session):
    session.install("PyInstaller==3.3.1")
    session.run("python", "make_executable.py")
