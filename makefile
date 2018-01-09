# run pip install -r dev_requirements.txt before running make test
.PHONY: test publish executable
test:
	flake8 gdbgui/backend.py --ignore=E121,E123,E126,E128,E501
	python setup.py test
	yarn test
	yarn build
	python setup.py checkdocs

clean:
	rm -rf dist build

testpublish: test clean
	python setup.py sdist bdist_wheel --universal
	twine upload dist/* -r pypitest

publish: test clean
	python setup.py sdist bdist_wheel --universal
	twine upload dist/*

executable: test
	pyinstaller gdbgui.spec --distpath executable --key a5s1fe65aw41f54sa64v6b4ds98fhea98rhg4etj4et78ku4yu87mn
