import subprocess
import sys

py36 = sys.version_info.major >= 3 and sys.version_info.minor >= 6


def run(cmd):
    print("Running %r" % " ".join(cmd))
    if py36:
        return subprocess.run(cmd).returncode
    else:
        return subprocess.call(cmd)


def main():
    files = ["gdbgui", "tests", "setup.py"]
    ret = 0
    # # TODO
    # if py36:
    #     ret += run(["black", "--check"] + files)
    ret += run(["flake8"] + files)
    return ret


if __name__ == "__main__":
    exit(main())
