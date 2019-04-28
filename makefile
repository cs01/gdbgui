# run pip install -e .[dev] before running make test
.PHONY: test publish executable build
test:
	python -m tests
	yarn test
	yarn build
	python setup.py checkdocs

clean:
	rm -rf dist build

testpublish: test clean
	python setup.py sdist bdist_wheel --universal
	twine upload dist/* -r pypitest


build: clean
	python -m pip install --upgrade --quiet setuptools wheel twine
	python setup.py --quiet sdist bdist_wheel
	twine check dist/*

publish: test clean build
	twine upload dist/*

docker_executables:
	# window
	docker build -t gdbgui_windows docker/windows
	docker run -v "`pwd`:/src/" gdbgui_windows

	# linux
	docker build -t gdbgui_linux docker/linux
	docker run -v "`pwd`:/src/" gdbgui_linux

executable:
	python make_executable.py
