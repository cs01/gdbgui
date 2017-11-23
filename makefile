# run pip install -r dev_requirements.txt before running make test
.PHONY: test publish
test:
	flake8 gdbgui/backend.py --ignore=E121,E123,E126,E128,E501
	python setup.py test
	yarn test
	yarn build
	python setup.py checkdocs

publish: test
	python setup.py sdist upload

testpublish: test
	python setup.py sdist upload -r pypitest
