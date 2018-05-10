FROM node:8.11.1

WORKDIR /app

COPY package.json /app

RUN npm install

COPY . /app

RUN npm run build

CMD node dist/src/bin/online-service.js --microservice job-manager
