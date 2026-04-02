# Backend Bridge

This folder contains a minimal Node.js bridge server for production deployment scenarios where a separate process is preferred.

## Usage

```bash
node server.js
```

The bridge responds with a health payload and can be extended to proxy requests to the FastAPI service.
