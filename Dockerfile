FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache git

RUN npm install

COPY . .

# 创建images目录并设置权限
RUN mkdir -p /app/images && \
    chown -R node:node /app/images

# 切换到非root用户
USER node

EXPOSE 3666

CMD ["node", "app.js", "--port", "3666"] 