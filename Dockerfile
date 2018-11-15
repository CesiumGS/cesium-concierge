FROM node:6

ENV NODE_ENV production

EXPOSE 5000

RUN apt-get update \
  && apt-get -y install cron supervisor nano --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

COPY . /var/app
WORKDIR /var/app

RUN npm install

RUN crontab crontab

RUN env > saved_env

ENTRYPOINT ["/usr/bin/supervisord", "-c", "/var/app/supervisord.conf"]
