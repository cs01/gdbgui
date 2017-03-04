# run pip install -r dev_requirements.txt before running make test
.PHONY: test
test:
	python setup.py test
	python setup.py checkdocs
