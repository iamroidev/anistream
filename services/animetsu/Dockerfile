FROM golang:1.22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git
RUN git clone --depth 1 https://github.com/ullamua/animetsu-api.git .
RUN CGO_ENABLED=0 go build -o animetsu-api .

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /app/animetsu-api .
ENV PORT=8080
EXPOSE 8080
USER nonroot:nonroot
CMD ["./animetsu-api"]
