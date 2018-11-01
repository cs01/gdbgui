import subprocess


def run(cmd):
    print("Running %r" % ' '.join(cmd))
    return subprocess.run(cmd).returncode


def main():
    files = ["gdbgui", "tests", "setup.py"]
    ret = 0
    # ret += run(["black", "--check"] + files)
    ret += run(["flake8"] + files)
    return ret


if __name__ == "__main__":
    exit(main())
