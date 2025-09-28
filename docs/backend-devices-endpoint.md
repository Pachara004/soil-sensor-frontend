# Backend Devices Endpoint Documentation

## Required Endpoint for Admin Panel

### GET /

**Description**: ดึงข้อมูล devices ทั้งหมดสำหรับ admin panel

**Authentication**: Required (Bearer Token)

**Headers**:
```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

**Response Format**: 
```json
[
  {
    "deviceid": "device123",
    "display_name": "Soil Sensor 1",
    "name": "Soil Sensor 1",
    "status": "active",
    "userid": 8,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

**Alternative Response Formats Supported**:
```json
// Format 1: Direct array
[{...}, {...}]

// Format 2: With devices property
{
  "devices": [{...}, {...}]
}

// Format 3: With data property  
{
  "data": [{...}, {...}]
}
```

**Database Query Example**:
```sql
SELECT * FROM public.device
ORDER BY deviceid ASC;
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Database error

**Notes**:
- Frontend expects either direct array or object with `devices`/`data` property
- All fields are optional in the interface
- `userid` field is used for user lookup in admin panel
- `created_at` field is formatted using `formatDate()` function
- Query returns ALL devices (no user filtering for admin panel)

## Backend Implementation

**Current Route**: `router.get('/', authMiddleware, async (req, res) => {...})`

**Required Change**: Modify the query to return all devices instead of filtering by userid

**Current Query**:
```sql
SELECT * FROM device WHERE userid = $1 ORDER BY created_at DESC
```

**Required Query**:
```sql
SELECT * FROM public.device ORDER BY deviceid ASC
```

**Priority**: High - Required for admin panel device selection functionality
