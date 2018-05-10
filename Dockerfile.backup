FROM ubuntu:16.04

# Update ubuntu and install dependencies
RUN apt-get update
RUN apt-get upgrade -y
RUN apt-get install -y curl apt-transport-https

# Install nodejs
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs build-essential

# Install mongodb
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5
RUN echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.6 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-3.6.list
RUN apt-get update
RUN apt-get install -y mongodb-org-tools

WORKDIR /app

COPY package.json /app

RUN npm install

COPY . /app

RUN npm run build

CMD node dist/src/bin/online-service.js --microservice backup
