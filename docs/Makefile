# Minimal makefile for Sphinx documentation
#

# You can set these variables from the command line.
SPHINXOPTS    =
SPHINXBUILD   = sphinx-build
SPHINXPROJ    = gdbgui
SOURCEDIR     = .
BUILDDIR      = _build
EXCLUDE_FROM_APIDOCS = tests *printcolor* *setup.py*

# # Put it first so that "make" without argument is like "make help".
# help:
# 	@$(SPHINXBUILD) -M help "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

.PHONY: help Makefile gen_apidoc html clean

html: clean gen_apidoc
	$(SPHINXBUILD) -b html . $(BUILDDIR)/html
	@echo
	@echo "Build finished. The HTML pages are in $(BUILDDIR)/html."

gen_apidoc:
	rm -rf api
	cd ..; sphinx-apidoc -o docs/api . $(EXCLUDE_FROM_APIDOCS)

clean:
	rm -rf _build
	rm -rf api

publish: html
	rsync --delete -pthrvz -c --rsh='ssh -p 22' _build/html/ root@grassfedcode.com:/var/www/grassfedcode.com/gdbgui
