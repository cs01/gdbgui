import os
VERSION_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'VERSION.txt')
__title__ = 'gdbgui'
__version__ = open(VERSION_PATH).read().strip()
__author__ = 'Chad Smith'
__copyright__ = 'Copyright Chad Smith'
