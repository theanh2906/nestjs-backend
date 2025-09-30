# Jenkins Integration

This document describes the Jenkins monitoring and build triggering integration for the System Monitoring page.

## Overview

The Jenkins integration provides:

- **Real-time Jenkins server monitoring** with health status and metrics
- **Job monitoring** with status, build history, and health scores
- **Remote build triggering** with parameter support
- **Queue monitoring** for pending builds
- **Responsive UI/UX** optimized for mobile devices

## Architecture

### Backend (NestJS)

- **Jenkins Service** (`src/services/jenkins.service.ts`) - Core Jenkins API communication
- **Jenkins Controller** (`src/controllers/jenkins.controller.ts`) - REST API endpoints
- **Base Controller** integration for consistent error handling and response formatting

### Frontend (Angular)

- **Jenkins Service** (`src/app/services/jenkins.service.ts`) - Frontend service with auto-refresh
- **Jenkins Models** (`src/app/models/jenkins.model.ts`) - TypeScript interfaces
- **Monitor Component** - Integrated Jenkins tab in System Monitoring page
- **Responsive SCSS** - Mobile-first design with adaptive layouts

## Configuration

### Backend Environment Variables

Add to your `.env` files (`local.env`, `prod.env`):

```bash
# Jenkins Configuration
JENKINS_URL=https://jenkins.benna.life
JENKINS_USERNAME=your_username  # Optional - for authenticated access
JENKINS_PASSWORD=your_password  # Optional - for authenticated access
```

### Frontend Configuration

The frontend automatically uses the configured API URL from environment files:

- Development: `https://backend.benna.life/api`
- Production: `https://backend.benna.life/api`

## API Endpoints

### Health & Status

- `GET /jenkins/health` - Jenkins server health check
- `GET /jenkins/status` - Comprehensive status summary

### Jobs Management

- `GET /jenkins/jobs` - List all Jenkins jobs
- `GET /jenkins/jobs/:jobName` - Get detailed job information
- `GET /jenkins/jobs/:jobName/builds` - Get job build history
- `POST /jenkins/jobs/:jobName/build` - Trigger a build

### System Information

- `GET /jenkins/system/info` - Jenkins system information
- `GET /jenkins/queue` - Build queue status

### Build Management

- `GET /jenkins/jobs/:jobName/builds/:buildNumber/console` - Console output
- `POST /jenkins/jobs/:jobName/builds/:buildNumber/stop` - Stop running build

## Features

### 📊 Real-time Monitoring

- Auto-refresh every 30 seconds
- Connection status indicators
- Server health monitoring
- Metrics cards with key statistics

### 🔧 Job Management

- Job status with color-coded indicators
- Health scores and build history
- Queue status and stuck job detection
- Search and filter capabilities

### 🚀 Build Triggering

- One-click build triggering
- Parameter support for parameterized builds
- Queue monitoring after trigger
- Build status notifications

### 📱 Responsive Design

- Mobile-first design approach
- Adaptive table layouts
- Touch-friendly action buttons
- Collapsible sections on small screens

## UI Components

### Jenkins Status Header

- Server health indicator
- Connection status
- Last update timestamp
- Manual refresh button

### Metrics Cards

- Total jobs count
- Active executors
- Queue items
- Server status
- Job status breakdown (success/failed/unstable)

### Jobs Table

- Sortable and searchable
- Job name with description
- Status indicators with animations
- Last build information
- Health scores
- Action buttons (Build, Open in Jenkins)

### Build Queue

- Pending builds list
- Queue reasons and timing
- Stuck job indicators
- Status tags

## Security

### Authentication

- Optional Jenkins username/password authentication
- Credentials stored in environment variables
- Backend acts as proxy to hide Jenkins server details

### Error Handling

- Comprehensive error handling with user-friendly messages
- Connection timeout management
- Rate limiting protection
- Graceful degradation when Jenkins is unavailable

## Testing

### Backend Testing

Run the test script to verify API endpoints:

```bash
cd nestjs-backend
node test-jenkins.js
```

### Manual Testing Checklist

#### Backend API

- [ ] Health check endpoint responds
- [ ] Jobs list loads successfully
- [ ] Job details fetch correctly
- [ ] Build triggering works (test carefully!)
- [ ] Queue information loads
- [ ] Error handling works for invalid requests

#### Frontend Integration

- [ ] Jenkins tab appears in System Monitoring
- [ ] Auto-refresh works every 30 seconds
- [ ] Metrics cards display correctly
- [ ] Jobs table is sortable and searchable
- [ ] Build trigger buttons work
- [ ] Mobile responsive design functions
- [ ] Error messages display appropriately

## Troubleshooting

### Common Issues

1. **"Unable to connect to Jenkins server"**

   - Check `JENKINS_URL` in environment variables
   - Verify network connectivity to Jenkins server
   - Check firewall settings

2. **Authentication errors**

   - Verify `JENKINS_USERNAME` and `JENKINS_PASSWORD`
   - Check Jenkins user permissions
   - Ensure user has build permissions for target jobs

3. **CORS errors**

   - Jenkins server may need CORS configuration
   - Consider using Jenkins API token instead of password

4. **Build triggering fails**
   - Check if job is buildable (`buildable: true`)
   - Verify job is not already in queue
   - Ensure user has build permissions

### Debug Mode

Enable debug logging in the backend:

```typescript
// In jenkins.service.ts, uncomment console.log statements
console.log('Jenkins API Request:', endpoint);
console.log('Jenkins API Response:', response.data);
```

## Performance Considerations

### Auto-refresh Strategy

- Staggered refresh intervals to avoid overwhelming Jenkins
- Jobs: Every 30 seconds
- Status: Every 30 seconds (1 second offset)
- Health: Every 30 seconds (2 seconds offset)
- Queue: Every 30 seconds (3 seconds offset)

### Caching

- Backend responses are cached for 30 seconds
- Frontend uses RxJS shareReplay for efficient data sharing
- Connection pooling for HTTP requests

### Mobile Optimization

- Responsive grid layouts
- Conditional column hiding on small screens
- Touch-friendly button sizing
- Optimized font sizes and spacing

## Future Enhancements

### Planned Features

- [ ] Build logs streaming
- [ ] Pipeline visualization
- [ ] Build artifacts download
- [ ] Custom dashboard widgets
- [ ] Advanced filtering and search
- [ ] Build notifications
- [ ] Jenkins plugin integration
- [ ] Multi-Jenkins server support

### Performance Improvements

- [ ] WebSocket integration for real-time updates
- [ ] Progressive loading for large job lists
- [ ] Offline mode with cached data
- [ ] Background sync with service workers

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review backend logs for detailed error messages
3. Test API endpoints directly using the test script
4. Verify Jenkins server accessibility and permissions

## License

This integration is part of the Useful Tools project and follows the same licensing terms.
