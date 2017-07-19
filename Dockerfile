FROM node:6

ENV NODE_ENV production

EXPOSE 5000

COPY . /var/app
WORKDIR /var/app

RUN npm install

ENTRYPOINT ["npm", "start"]
