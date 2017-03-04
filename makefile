# run pip install -r dev_requirements.txt before running make test
.PHONY: test publish
test:
	python setup.py test
	python setup.py checkdocs

publish: test
	python setup.py sdist upload
