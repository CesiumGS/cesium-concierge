FROM node:6

ENV NODE_ENV production

EXPOSE 5000

RUN apt-get update \
  && apt-get -y install cron supervisor --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN npm install

COPY . /var/app
WORKDIR /var/app

COPY supervisord.conf /etc/supervisord.conf

# Add crontab file in the cron directory
ADD crontab /etc/cron.d/bumper-cron

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/bumper-cron

RUN touch /etc/crontab /etc/cron.*/* /var/log/cron.log

# RUN useradd --no-log-init -m -g users concierge \
#  && chown -R concierge /var/app

# USER concierge:users

ENTRYPOINT ["/usr/bin/supervisord"]
