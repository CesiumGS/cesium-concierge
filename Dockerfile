FROM node:10-alpine

ENV NODE_ENV production

EXPOSE 5000

COPY . /var/app
WORKDIR /var/app

RUN apk add --update nano bash \
  && rm -rf /tmp/* /var/cache/apk/* \
  && npm install \
  && npm cache clear --force

ENTRYPOINT ["/bin/bash", "-c"]
CMD [ "npm start" ]
