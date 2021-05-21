FROM node:16.6.1-alpine

COPY ./demo /app/demo
COPY ./dist /app/dist
COPY ./package.json /app/package.json

RUN cd /app && npm install

WORKDIR /app/demo

RUN npm install

CMD [ "node", "index.js" ]
