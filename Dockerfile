FROM node:16-alpine

WORKDIR /app

ENV NEXT_PUBLIC_API_BASE_URL=http://rent-it-backend:4000/

COPY package.json yarn.lock /app/
RUN yarn install
COPY . /app
RUN yarn build

CMD ["yarn", "start"]