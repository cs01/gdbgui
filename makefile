# run pip install -e .[dev] before running make test
.PHONY: test publish executable build
test:
	check-manifest --ignore build.js,gdbgui/static/js,gdbgui/static/js/build.js.map
	python setup.py checkdocs
	python -m tests
	yarn install
	yarn test
	yarn build

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
