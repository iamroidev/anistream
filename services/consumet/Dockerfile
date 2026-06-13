FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
RUN git clone --depth 1 https://github.com/consumet/api.consumet.org.git .
RUN npm install
ENV NODE_ENV=PROD
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
