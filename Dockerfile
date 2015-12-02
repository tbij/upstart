FROM node:5.1

RUN apt-get update
RUN apt-get install -y build-essential

COPY . .

RUN npm install

CMD node upstart

EXPOSE 3000
