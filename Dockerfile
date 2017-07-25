FROM node:6

ENV NODE_ENV production

EXPOSE 5000

COPY . /var/app
WORKDIR /var/app

RUN useradd --no-log-init -m -g users concierge \
  && chown -R concierge /var/app

USER concierge:users
RUN npm install

ENTRYPOINT ["npm", "start"]
