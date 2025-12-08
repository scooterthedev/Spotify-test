# Sync Feature Testing Guide

## Bug Fixes

### Issue: Join Session Failed with Invalid Code
**Root Cause:** The API was treating the 6-character code as a full sessionId. The lookup failed because:
- Session creation generated a 32-character hex ID
- Code was only the first 6 characters of the ID
- Joining with code looked for the code in the sessionId, not in a code-to-sessionId mapping

**Fix Implemented:**
1. Created `codeToSessionId` Map to track code-to-sessionId relationships
2. Added logic to detect if sessionId is a code (length === 6) vs full ID (length > 6)
3. Updated all actions (join, update, get) to resolve codes to sessionIds
4. Added proper error messages for invalid codes

### Error Message Improvements
- Added `errorMessage` state to SyncPlayer component
- Displays specific error from API instead of generic "An error occurred"
- Better error UI with red background and clear messaging

---

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

---

## Test Files

### 1. `__tests__/sync-session.test.js` - API Route Tests

Tests the `/api/sync/session` endpoint comprehensively.

**Test Coverage:**

#### Create Session
```javascript
✓ should create a new sync session with a code
✓ should generate unique codes for each session
```

#### Join Session
```javascript
✓ should join an existing session with full sessionId
✓ should join an existing session with code
✓ should allow multiple devices to join
✓ should return 404 for invalid session code
✓ should return 404 for invalid full sessionId
```

#### Update Progress
```javascript
✓ should update progress with full sessionId
✓ should update progress with code
✓ should return 404 for update on non-existent session
✓ should return 404 for update from device not in session
```

#### Get Session
```javascript
✓ should get session state with full sessionId
✓ should get session state with code
✓ should return 404 for invalid session code
✓ should track progress updates
```

#### Error Handling
```javascript
✓ should return 400 for invalid action
✓ should handle missing parameters gracefully
```

**Run API tests only:**
```bash
npm test sync-session.test.js
```

---

### 2. `__tests__/sync-player.test.jsx` - Component Tests

Tests the SyncPlayer React component and user interactions.

**Test Coverage:**

#### Initial State
```javascript
✓ should render the initial UI with create button
✓ should generate unique device IDs on mount
```

#### Creating Sessions
```javascript
✓ should successfully create a session
✓ should display the share code after creating session
✓ should show error message on create failure
```

#### Joining Sessions
```javascript
✓ should successfully join with a valid code
✓ should show error on invalid code
✓ should limit code input to 6 characters
✓ should convert code to uppercase
✓ should disable join button when code is empty
✓ should disable join button while joining
```

#### Connected State
```javascript
✓ should show connected status when in session
✓ should show list of connected devices
✓ should show end session button when connected
✓ should end session when button is clicked
```

#### Sync Progress
```javascript
✓ should call onSyncProgress with progress updates
```

**Run component tests only:**
```bash
npm test sync-player.test.jsx
```

---

## Manual Testing Checklist

### Setup
- [ ] Start the app: `npm run dev`
- [ ] Open two browser tabs to localhost:3000

### Create Session (Tab 1 - Host)
- [ ] Click "Sync Across Devices"
- [ ] Click "Create Sync Session"
- [ ] Verify 6-character code appears (e.g., `A1B2C3`)
- [ ] Verify "Connected" status shows
- [ ] Verify "Share Code" panel displays

### Join Session (Tab 2 - Client)
- [ ] Click "Sync Across Devices"
- [ ] Enter the 6-character code from Tab 1
- [ ] Click "Join"
- [ ] Verify "Connected" status appears
- [ ] Verify device count shows 2 devices
- [ ] Verify no error message appears

### Error Cases
- [ ] Try joining with invalid code (e.g., `INVALID`)
- [ ] Verify error message appears: "Invalid session code"
- [ ] Try joining with code that doesn't exist
- [ ] Verify error message appears

### Progress Sync
- [ ] Play music on Tab 1 (or any Spotify track)
- [ ] Verify Tab 2 shows progress updates
- [ ] Pause on Tab 1
- [ ] Verify Tab 2 stops updating
- [ ] Resume on Tab 1
- [ ] Verify Tab 2 resumes updates

### Cleanup
- [ ] Click "End Session" on either tab
- [ ] Verify UI returns to initial state
- [ ] Verify "Create Sync Session" button appears

---

## Testing Scenarios

### Scenario 1: Full Flow - Create and Join

**Steps:**
1. Device A: Create session → Get code `ABC123`
2. Device B: Join with code `ABC123`
3. Device A: Play song
4. Device B: See progress updates
5. Device A: Pause
6. Device B: See pause
7. Device A: End session

**Expected Outcome:**
- Both devices sync perfectly
- No errors or crashes
- Smooth UI updates

### Scenario 2: Multiple Devices

**Steps:**
1. Device A: Create session
2. Device B: Join
3. Device C: Join
4. Device A: Play song
5. All devices: See progress

**Expected Outcome:**
- All 3 devices appear in device list
- All receive progress updates
- Session handles 3+ concurrent devices

### Scenario 3: Error Recovery

**Steps:**
1. Device A: Create session
2. Device B: Try to join with wrong code → Error
3. Device B: Enter correct code → Success
4. Device A: Lose connection (close tab)
5. Device B: Still receives updates for 30 minutes (in production)

**Expected Outcome:**
- Errors show clear messages
- Users can retry without refreshing
- Session persists properly

### Scenario 4: Code Input Validation

**Steps:**
1. Device A: Create session
2. Device B: Input lowercase code → auto-converts to uppercase
3. Device B: Input more than 6 chars → truncates to 6
4. Device B: Leave code empty → Join button disabled

**Expected Outcome:**
- All validations work
- Join button state correct

---

## API Response Examples

### Create Session
```json
{
  "sessionId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "code": "A1B2C3"
}
```

### Join Session (Success)
```json
{
  "success": true,
  "session": {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "code": "A1B2C3",
    "currentProgressMs": 0,
    "isPlaying": false,
    "devices": [
      {
        "id": "device_abc123",
        "name": "Device AB12",
        "joinedAt": 1702000000000,
        "progressMs": 0
      }
    ]
  }
}
```

### Join Session (Error)
```json
{
  "error": "Invalid session code"
}
```

### Get Session
```json
{
  "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "currentProgressMs": 45000,
  "isPlaying": true,
  "devices": [
    {
      "id": "device_host",
      "name": "Device HO12",
      "progressMs": 45000
    },
    {
      "id": "device_client",
      "name": "Device CL34",
      "progressMs": 45000
    }
  ]
}
```

---

## Troubleshooting

### Test Failure: "fetch is not defined"
**Solution:** Ensure `jest.setup.js` exists and jest.config.js includes it

### Test Failure: "Cannot find module '@/...'"
**Solution:** Check jest.config.js has correct moduleNameMapper for `@/` alias

### Manual Testing: Code doesn't work on second attempt
**Current State:** Sessions stored in memory, lost on server restart
**Solution for Production:** Implement Redis session storage with TTL

### Manual Testing: Code expires after 30 minutes
**Current State:** Not implemented (infinite persistence)
**To Implement:** Add TTL and cleanup logic in API route

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

---

## Performance Testing

### Load Test: Multiple Concurrent Sessions

**Test Script:**
```javascript
async function loadTest() {
  const codes = [];
  
  // Create 10 sessions
  for (let i = 0; i < 10; i++) {
    const res = await fetch('/api/sync/session', {
      method: 'POST',
      body: JSON.stringify({ action: 'create' })
    });
    const data = await res.json();
    codes.push(data.code);
  }
  
  // Join all sessions simultaneously
  await Promise.all(codes.map(code => 
    fetch('/api/sync/session', {
      method: 'POST',
      body: JSON.stringify({
        action: 'join',
        sessionId: code,
        deviceId: `device_${Math.random()}`,
        deviceName: 'Test Device',
        progressMs: 0
      })
    })
  ));
  
  console.log('All sessions created and joined successfully');
}
```

---

## Known Limitations

1. **In-Memory Storage:** Sessions lost on server restart
   - Fix: Use Redis in production

2. **No Session Expiry:** Sessions persist indefinitely
   - Fix: Add 30-minute TTL in production

3. **No Authentication:** Anyone can join any session
   - Fix: Add optional password protection

4. **No Offline Support:** Secondary devices can't play if host is offline
   - Fix: Queue progress updates with Service Workers

---

## Next Steps

1. ✅ Fix code lookup bug (DONE)
2. ✅ Add error messages (DONE)
3. ✅ Add comprehensive tests (DONE)
4. 🔲 Add Redis session storage
5. 🔲 Implement session expiry (30 min TTL)
6. 🔲 Add password protection
7. 🔲 Add analytics (sessions created, duration, etc.)
8. 🔲 WebSocket for real-time updates

---

## Support

For issues or questions:
1. Check error message in UI
2. Open browser console (F12)
3. Check test files for examples
4. Review SYNC_INTEGRATION.md for API details
