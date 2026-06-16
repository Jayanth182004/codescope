import sys
import logging
from app.core.config import settings

def setup_logging():
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "default",
            }
        },
        "root": {
            "level": "INFO",
            "handlers": ["console"]
        }
    }
    
    import logging.config
    logging.config.dictConfig(logging_config)
