# enterprise-resource-management-platform-215220-215229

Frontend/Backend wiring:
- Frontend expects a FastAPI backend and reads the base URL from `REACT_APP_API_BASE` (see resource_platform_frontend/.env.example). If unset, it falls back to `http://localhost:3001`.
- Backend should allow CORS from the frontend origin (default `http://localhost:3000`). Set `FRONTEND_ORIGIN` in the backend `.env` to override or allow multiple origins (comma-separated).