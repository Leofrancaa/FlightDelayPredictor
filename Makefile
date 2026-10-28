#################################################################################
# GLOBALS                                                                       #
#################################################################################

PROJECT_NAME = decea
PYTHON_VERSION = 3.12
PYTHON_INTERPRETER = python3

#################################################################################
# COMMANDS                                                                      #
#################################################################################


## Install Python dependencies
.PHONY: requirements
requirements:
	uv sync


## Delete all compiled Python files
.PHONY: clean
clean:
	find . -type f -name "*.py[co]" -delete
	find . -type d -name "__pycache__" -delete


## Lint using ruff (use `make format` to do formatting)
.PHONY: lint
lint:
	uv run ruff format --check
	uv run ruff check

## Format source code with ruff
.PHONY: format
format:
	uv run ruff check --fix
	uv run ruff format


## Run tests
.PHONY: test
test:
	uv run pytest tests


## Set up Python interpreter environment
.PHONY: create_environment
create_environment:
	uv venv --python $(PYTHON_VERSION)
	@echo ">>> New uv virtual environment created. Activate with:"
	@echo ">>> Unix/macOS: source ./.venv/bin/activate"


#################################################################################
# PROJECT RULES                                                                 #
#################################################################################


## Train the US model and export the site data to web/public/data (needs data/raw/bts and data/raw/metar_eua)
.PHONY: treinar
treinar:
	uv run python -m module_decea.exportar_web_eua


## Run the "with vs without tail number" BTS experiment (writes reports/bts)
.PHONY: experimento
experimento:
	uv run python -m module_decea.experimento_bts


#################################################################################
# Self Documenting Commands                                                    #
#################################################################################

.DEFAULT_GOAL := help

define PRINT_HELP_PYSCRIPT
import re, sys; \
lines = '\n'.join([line for line in sys.stdin]); \
matches = re.findall(r'\n## (.*)\n[\s\S]+?\n([a-zA-Z_-]+):', lines); \
print('Available rules:\n'); \
print('\n'.join(['{:25}{}'.format(*reversed(match)) for match in matches]))
endef
export PRINT_HELP_PYSCRIPT

help:
	@$(PYTHON_INTERPRETER) -c "${PRINT_HELP_PYSCRIPT}" < $(MAKEFILE_LIST)
