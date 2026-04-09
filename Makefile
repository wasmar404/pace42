.PHONY: up down prune nuke

COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.yml

up:
	$(COMPOSE) -f $(COMPOSE_FILE) build --no-cache
	$(COMPOSE) -f $(COMPOSE_FILE) up -d --force-recreate --remove-orphans

down:
	$(COMPOSE) -f $(COMPOSE_FILE) down --volumes --remove-orphans --rmi all
	@if [ "$(NUKE)" = "1" ]; then \
		docker volume prune -f; \
		docker network prune -f; \
		docker container prune -f; \
		docker image prune -af; \
		docker builder prune -af; \
		docker system prune -af --volumes; \
	fi

prune:
	docker volume prune -f
	docker network prune -f
	docker container prune -f
	docker image prune -af
	docker builder prune -af

nuke:
	$(MAKE) down NUKE=1
