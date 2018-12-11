FROM node:10

ENV NODE_ENV production

EXPOSE 5000

RUN apt-get update \
  && apt-get -y install supervisor nano --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

COPY . /var/app
WORKDIR /var/app

RUN npm install

RUN npm config set script-shell /bin/bash

ENTRYPOINT ["/usr/bin/supervisord", "-c", "/var/app/supervisord.conf"]
