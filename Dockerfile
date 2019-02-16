FROM node:10-alpine

ENV NODE_ENV production

EXPOSE 5000

COPY . /var/app
WORKDIR /var/app

RUN apk add --no-cache tzdata
ENV TZ America/New_York
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apk add --update nano bash \
  && rm -rf /tmp/* /var/cache/apk/* \
  && npm install \
  && npm cache clear --force

ENTRYPOINT ["/bin/bash", "-c"]
CMD [ "npm start" ]
