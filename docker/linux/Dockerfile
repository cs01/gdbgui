FROM ubuntu:18.04

ENV DEBIAN_FRONTEND noninteractive

ARG PYINSTALLER_VERSION=3.3

# install python
RUN set -x \
    && apt-get update -qy \
    && apt-get install --no-install-recommends -qfy python3 python3-dev python3-pip python3-setuptools python3-wheel build-essential libmysqlclient-dev git \
    && apt-get clean

# PYPI repository location
ENV PYPI_URL=https://pypi.python.org/
# PYPI index location
ENV PYPI_INDEX_URL=https://pypi.python.org/simple

# install pyinstaller
RUN pip3 install pyinstaller==$PYINSTALLER_VERSION
RUN ln -s /usr/bin/pip3 /usr/bin/pip

RUN mkdir /src/
VOLUME /src/
WORKDIR /src/

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
