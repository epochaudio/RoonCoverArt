FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache git

RUN npm install

COPY . .

EXPOSE 3666

CMD ["node", "app.js", "--port", "3666"] 