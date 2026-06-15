SHELL := /bin/bash

.PHONY: bootstrap dev stop test build lint dev-backend dev-frontend dev-db stop-db backend-test frontend-test docker-up docker-down

bootstrap:
	./scripts/bootstrap.sh

dev:
	./scripts/dev.sh

stop:
	./scripts/stop-dev.sh

test:
	./scripts/check.sh

build:
	cd backend && mvn -DskipTests package
	cd frontend && npm run build

lint:
	cd frontend && npm run lint

dev-backend:
	cd backend && ./scripts/start-backend.sh

dev-frontend:
	cd frontend && npm run dev -- --host 127.0.0.1

dev-db:
	cd backend && ./scripts/start-postgres.sh

stop-db:
	cd backend && ./scripts/stop-postgres.sh

backend-test:
	cd backend && mvn test

frontend-test:
	cd frontend && npm test

docker-up:
	docker compose up --build

docker-down:
	docker compose down --remove-orphans
