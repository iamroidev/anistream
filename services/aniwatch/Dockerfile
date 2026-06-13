FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
RUN git clone --depth 1 https://github.com/ghoshRitesh12/aniwatch-api.git .
RUN npm install
ENV ANIWATCH_API_DEPLOYMENT_ENV=docker
ENV PORT=4000
EXPOSE 4000
CMD ["npm", "start"]
