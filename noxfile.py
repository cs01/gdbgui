import nox  # type: ignore
from pathlib import Path


nox.options.sessions = ["test", "lint", "docs"]
python = ["3.5", "3.6", "3.7", "3.8"]


doc_dependencies = [".", "mkdocs", "mkdocs-material"]
lint_dependencies = ["black", "flake8", "mypy", "check-manifest"]


@nox.session(python=python)
def test(session):
    session.install(".")
    session.run("python", "-m", "unittest", "discover")
    session.run("yarn", "install")
    session.run("yarn", "test")
    session.run("yarn", "build")


@nox.session(python=python)
def lint(session):
    session.install(*lint_dependencies)
    files = ["gdbgui", "tests"] + [str(p) for p in Path(".").glob("*.py")]
    session.run("black", "--check", *files)
    session.run("flake8", *files)
    # session.run("mypy", *files)  # TODO
    session.run(
        "check-manifest",
        "--ignore",
        "build.js,gdbgui/static/js,gdbgui/static/js/build.js.map",
    )
    session.run("python", "setup.py", "check", "--metadata", "--strict")


@nox.session(python="3.6")
def docs(session):
    session.install(*doc_dependencies)
    session.run("python", "generate_docs.py")
    session.run("mkdocs", "build")


@nox.session(python="3.6")
def develop(session):
    session.install(*doc_dependencies, *lint_dependencies)
    session.install("-e", ".")


@nox.session(python="3.6")
def build(session):
    session.install("setuptools", "wheel", "twine")
    session.run("rm", "-rf", "dist", external=True)
    session.run("python", "setup.py", "--quiet", "sdist", "bdist_wheel")
    session.run("twine", "check", "dist/*")


@nox.session(python="3.6")
def publish(session):
    build(session)
    print("REMINDER: Has the changelog been updated?")
    session.run("python", "-m", "twine", "upload", "dist/*")


@nox.session(python="3.6")
def watch_docs(session):
    session.install(*doc_dependencies)
    session.run("mkdocs", "serve")


@nox.session(python="3.6")
def publish_docs(session):
    session.install(*doc_dependencies)
    session.run("python", "generate_docs.py")
    session.run("mkdocs", "gh-deploy")


@nox.session(python="3.6")
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

