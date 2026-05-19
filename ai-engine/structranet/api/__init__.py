# Lazy imports to avoid circular import:
#   core.__init__ → pipeline → api.models → api.__init__ → api.app → core.pipeline
# Import directly from the module files instead:
#   from structranet.api.app import app
#   from structranet.api.models import ...
