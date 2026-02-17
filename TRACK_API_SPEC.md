# API Specification

Base URL: `http://localhost:8080` (Default)

## Authentication

All endpoints require an API Key header.

- **Header**: `X-API-Key`
- **Types**:
  - `ADMIN_API_KEY`: Has access to all endpoints.
  - `INGEST_API_KEY`: Has access strictly to ingest endpoints (`POST /v1/ingest/position`).

## Standard Response Format

All API responses follow a standard JSON structure.

### Success Response (2xx)

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response payload...
  }
}
```

### Error Response (4xx, 5xx)

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Optional details for validation errors
    {
      "field": "label",
      "tag": "required",
      "message": "This field is required"
    }
  ]
}
```

---

## Endpoints

### 1. System

#### Health Check

Check system status.

- **URL**: `/health`
- **Method**: `GET`
- **Auth**: Optional (depending on config, usually public)

**Response:**

```json
{
  "success": true,
  "message": "System operational",
  "data": {
    "status": "ok"
  }
}
```

---

### 2. Events

#### Create Event

Create a new tracking event.

- **URL**: `/v1/events`
- **Method**: `POST`
- **Auth**: ADMIN

**Request Body:**

```json
{
  "name": "Mudik Lewat Tol 2026",
  "start_at": "2026-04-01T00:00:00Z",
  "end_at": "2026-04-15T23:59:59Z"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Mudik Lewat Tol 2026",
    "start_at": "2026-04-01T00:00:00Z",
    "end_at": "2026-04-15T23:59:59Z",
    "created_at": "2026-02-02T10:00:00Z"
  }
}
```

#### List Events

Get all events.

- **URL**: `/v1/events`
- **Method**: `GET`
- **Auth**: ADMIN

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Events retrieved successfully",
  "data": {
    "items": [
      {
        "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "name": "Mudik Lewat Tol 2026",
        "start_at": "2026-04-01T00:00:00Z",
        "end_at": "2026-04-15T23:59:59Z",
        "created_at": "2026-02-02T10:00:00Z"
      }
    ]
  }
}
```

---

### 3. Trackers

#### Create Tracker

Add a tracker to an event.

- **URL**: `/v1/events/:event_id/trackers`
- **Method**: `POST`
- **Auth**: ADMIN

**Request Body:**

```json
{
  "label": "Bus 01 - Agra Mas",
  "kind": "bus"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Tracker created successfully",
  "data": {
    "id": "trk_a1b2c3d4",
    "event_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "label": "Bus 01 - Agra Mas",
    "kind": "bus",
    "is_active": true,
    "last_seen_at": null,
    "created_at": "2026-02-02T10:05:00Z"
  }
}
```

#### List Trackers

Get all trackers for a specific event.

- **URL**: `/v1/events/:event_id/trackers`
- **Method**: `GET`
- **Auth**: ADMIN

**Response (200 OK):**

````json
{
  "success": true,
  "message": "Trackers retrieved successfully",
  "data": {
    "items": [
      {
        "id": "trk_a1b2c3d4",
        "event_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "label": "Bus 01 - Agra Mas",
        "kind": "bus",
        "is_active": true,
        "last_seen_at": "2026-04-01T08:00:00Z",
        "created_at": "2026-02-02T10:05:00Z"
      }
    ]
  }
}

#### Monitoring (Latest Locations)
Get trackers enriched with their latest position.

*   **URL**: `/v1/events/:event_id/monitoring`
*   **Method**: `GET`
*   **Auth**: ADMIN

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Monitoring data retrieved successfully",
  "data": {
    "items": [
      {
        "id": "trk_a1b2c3d4",
        "event_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "label": "Bus 01 - Agra Mas",
        "kind": "bus",
        "is_active": true,
        "last_seen_at": "2026-04-01T08:00:00Z",
        "lat": -6.345,
        "lon": 106.892,
        "speed": 45.5,
        "heading": 120.0,
        "accuracy": 5.0,
        "ts": "2026-04-01T08:00:00Z",
        "created_at": "2026-02-02T10:05:00Z"
      }
    ]
  }
}
````

#### Update Tracker Status

Enable or disable a tracker.

- **URL**: `/v1/trackers/:tracker_id`
- **Method**: `PATCH`
- **Auth**: ADMIN

**Request Body:**

```json
{
  "is_active": false
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Tracker updated successfully",
  "data": null
}
```

---

### 4. Positions (Ingest & Query)

#### Ingest Position

Send GPS data for a tracker.

- **URL**: `/v1/ingest/position`
- **Method**: `POST`
- **Auth**: INGEST or ADMIN

**Request Body:**

```json
{
  "tracker_id": "trk_a1b2c3d4",
  "ts": "2026-04-01T08:00:00Z",
  "lat": -6.345,
  "lon": 106.892,
  "speed": 45.5,
  "heading": 120.0,
  "accuracy": 5.0
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Position ingested successfully",
  "data": {
    "ok": true
  }
}
```

**Error Response (Validation Failed):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "lat",
      "tag": "latitude",
      "value": "-200",
      "message": "Latitude must be between -90 and 90"
    }
  ]
}
```

#### Query Positions

Get historical path/positions of a tracker.

- **URL**: `/v1/trackers/:tracker_id/positions`
- **Method**: `GET`
- **Auth**: ADMIN
- **Query Params**:
  - `from`: ISO8601 Timestamp (optional, default: now - 6h)
  - `to`: ISO8601 Timestamp (optional, default: now)
  - `limit`: Integer (optional, default: 2000, max: 20000)

**Example URL**: `/v1/trackers/trk_a1b2c3d4/positions?limit=100&from=2026-04-01T00:00:00Z`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Positions retrieved successfully",
  "data": {
    "tracker_id": "trk_a1b2c3d4",
    "items": [
      {
        "tracker_id": "trk_a1b2c3d4",
        "ts": "2026-04-01T08:00:00Z",
        "lat": -6.345,
        "lon": 106.892,
        "speed": 45.5,
        "heading": 120.0,
        "accuracy": 5.0
      },
      {
        "tracker_id": "trk_a1b2c3d4",
        "ts": "2026-04-01T07:59:55Z",
        "lat": -6.344,
        "lon": 106.891,
        "speed": 43.2,
        "heading": 121.0,
        "accuracy": 4.8
      }
    ]
  }
}
```
