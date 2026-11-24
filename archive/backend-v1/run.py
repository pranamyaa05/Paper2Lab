import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print(f"Starting {settings.PROJECT_NAME} on http://localhost:{settings.PORT}")
    print(f"API Documentation available at: http://localhost:{settings.PORT}{settings.API_V1_STR}/docs")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
