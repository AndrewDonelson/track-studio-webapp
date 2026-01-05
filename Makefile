# Track Studio WebApp - Makefile
# Deployment automation

# Configuration
APP_NAME := track-studio-webapp
VERSION := 0.1.0

# Deployment targets
MULE_HOST := andrew@192.168.1.200
MULE_PATH := /home/andrew/trackstudio/webapp
WEBAPP_PORT := 3000
SUDO_PASS := yy1660277

# Colors for output
COLOR_RESET := \033[0m
COLOR_BOLD := \033[1m
COLOR_GREEN := \033[32m
COLOR_YELLOW := \033[33m
COLOR_BLUE := \033[34m

.PHONY: all help build deploy-mule status-mule logs-mule restart-mule dev install clean

## help: Display this help message
help:
	@echo "$(COLOR_BOLD)Track Studio WebApp - Available Commands$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_BLUE)Development:$(COLOR_RESET)"
	@echo "  make dev          - Run in development mode"
	@echo "  make build        - Build production bundle"
	@echo "  make start        - Start production server locally"
	@echo ""
	@echo "$(COLOR_BLUE)Deployment:$(COLOR_RESET)"
	@echo "  make deploy-mule  - Deploy to mule.nlaakstudios"
	@echo "  make status-mule  - Check webapp status on mule"
	@echo "  make logs-mule    - View webapp logs on mule"
	@echo "  make restart-mule - Restart webapp on mule"
	@echo ""
	@echo "$(COLOR_BLUE)Utilities:$(COLOR_RESET)"
	@echo "  make install      - Install dependencies"
	@echo "  make clean        - Clean build artifacts"
	@echo ""

## dev: Run in development mode
dev:
	@echo "$(COLOR_GREEN)Starting development server...$(COLOR_RESET)"
	npm run dev

## build: Build production bundle
build:
	@echo "$(COLOR_GREEN)Building production bundle...$(COLOR_RESET)"
	npm run build
	@echo "$(COLOR_GREEN)✓ Build complete$(COLOR_RESET)"

## start: Start production server locally
start:
	@echo "$(COLOR_GREEN)Starting production server...$(COLOR_RESET)"
	npm run start

## install: Install dependencies
install:
	@echo "$(COLOR_BLUE)Installing dependencies...$(COLOR_RESET)"
	npm install
	@echo "$(COLOR_GREEN)✓ Dependencies installed$(COLOR_RESET)"

## clean: Clean build artifacts
clean:
	@echo "$(COLOR_YELLOW)Cleaning build artifacts...$(COLOR_RESET)"
	rm -rf .next
	rm -rf node_modules/.cache
	@echo "$(COLOR_GREEN)✓ Clean complete$(COLOR_RESET)"

## deploy-mule: Deploy to mule.nlaakstudios
deploy-mule: build
	@echo "$(COLOR_GREEN)Deploying webapp to $(MULE_HOST)...$(COLOR_RESET)"
	@echo "$(COLOR_BLUE)→ Checking Node.js and npm installation...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "echo 'Installing Node.js 20.x and npm...'; curl -fsSL https://deb.nodesource.com/setup_20.x | echo '$(SUDO_PASS)' | sudo -S bash - && echo '$(SUDO_PASS)' | sudo -S apt-get install -y nodejs npm" || true
	@echo "$(COLOR_BLUE)→ Stopping existing webapp...$(COLOR_RESET)"
	-@ssh $(MULE_HOST) "pkill -f 'next start'" 2>/dev/null || true
	@sleep 1
	@echo "$(COLOR_BLUE)→ Creating directories...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "mkdir -p $(MULE_PATH)"
	@echo "$(COLOR_BLUE)→ Uploading build...$(COLOR_RESET)"
	@rsync -avz --progress --delete \
		--exclude='node_modules' \
		--exclude='.git' \
		--exclude='.next/cache' \
		./ $(MULE_HOST):$(MULE_PATH)/
	@echo "$(COLOR_BLUE)→ Installing dependencies on mule...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "cd $(MULE_PATH) && export PATH=\"$PATH:/usr/local/bin:/usr/bin\" && npm install --production"
	@echo "$(COLOR_BLUE)→ Starting webapp...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "cd $(MULE_PATH) && export PATH=\"$PATH:/usr/local/bin:/usr/bin\" && PORT=$(WEBAPP_PORT) HOST=0.0.0.0 nohup npm start > webapp.log 2>&1 &"
	@sleep 3
	@echo "$(COLOR_GREEN)✓ Deployment complete!$(COLOR_RESET)"
	@echo ""
	@echo "WebApp running on: $(COLOR_BOLD)http://192.168.1.200:$(WEBAPP_PORT)$(COLOR_RESET)"
	@echo "API endpoint:      $(COLOR_BOLD)http://192.168.1.200:8080$(COLOR_RESET)"
	@echo ""
	@echo "Check status with: $(COLOR_BOLD)make status-mule$(COLOR_RESET)"
	@echo "View logs with:    $(COLOR_BOLD)make logs-mule$(COLOR_RESET)"

## status-mule: Check webapp status on mule
status-mule:
	@echo "$(COLOR_BLUE)Checking webapp status on $(MULE_HOST)...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "ps aux | grep 'next start' | grep -v grep || echo 'WebApp not running'"

## logs-mule: View webapp logs on mule
logs-mule:
	@echo "$(COLOR_BLUE)Viewing logs on $(MULE_HOST) (Ctrl+C to exit)...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "tail -f $(MULE_PATH)/webapp.log"

## restart-mule: Restart webapp on mule
restart-mule:
	@echo "$(COLOR_BLUE)Restarting webapp on $(MULE_HOST)...$(COLOR_RESET)"
	@ssh $(MULE_HOST) "pkill -f 'next start' || true"
	@sleep 1
	@ssh $(MULE_HOST) "cd $(MULE_PATH) && PORT=$(WEBAPP_PORT) nohup npm start > webapp.log 2>&1 &"
	@sleep 3
	@echo "$(COLOR_GREEN)✓ WebApp restarted$(COLOR_RESET)"
	@$(MAKE) status-mule

## test-cqai: Test connection to cqai from mule
test-cqai:
	@echo "$(COLOR_BLUE)Testing connections from mule to cqai.nlaakstudios...$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_YELLOW)Testing Ollama API (LLM):$(COLOR_RESET)"
	@ssh $(MULE_HOST) "curl -s http://cqai.nlaakstudios:11434/api/tags | head -20 && echo '$(COLOR_GREEN)✓ Ollama API accessible$(COLOR_RESET)' || echo '$(COLOR_YELLOW)✗ Ollama API not accessible$(COLOR_RESET)'"
	@echo ""
	@echo "$(COLOR_YELLOW)Testing Image Generation API:$(COLOR_RESET)"
	@ssh $(MULE_HOST) "curl -s http://cqai.nlaakstudios/health && echo '$(COLOR_GREEN)✓ Image API accessible$(COLOR_RESET)' || echo '$(COLOR_YELLOW)✗ Image API not accessible$(COLOR_RESET)'"
	@echo ""
	@echo "$(COLOR_YELLOW)Testing from Orchestrator:$(COLOR_RESET)"
	@ssh $(MULE_HOST) "curl -s http://localhost:8080/api/v1/health && echo '$(COLOR_GREEN)✓ Orchestrator API accessible$(COLOR_RESET)' || echo '$(COLOR_YELLOW)✗ Orchestrator not running$(COLOR_RESET)'"

# Default target
all: build

