# Judge0 Infrastructure

This directory contains deployment notes and configuration for Judge0 CE.

## MVP: RapidAPI (Hosted)

For the hackathon MVP, we use **Judge0 CE via RapidAPI**:

1. Sign up at [RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce)
2. Subscribe to a plan (free tier available)
3. Get your API key and host from the RapidAPI dashboard
4. Set environment variables:
   ```
   JUDGE0_URL=https://judge0-ce.p.rapidapi.com
   JUDGE0_API_KEY=your-rapidapi-key
   JUDGE0_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
   ```

## Post-MVP: Self-Hosted

If you need to self-host Judge0 for higher throughput or cost reasons:

### Docker Compose Setup

```yaml
# docker-compose.yml
version: "3"
services:
  judge0:
    image: judge0/judge0:1.13.1
    ports:
      - "2358:2358"
    environment:
      - JUDGE0_ENABLE_BATCHED_SUBMISSIONS=true
      - JUDGE0_MAX_QUEUE_SIZE=100
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=judge0
      - POSTGRES_USER=judge0
      - POSTGRES_PASSWORD=secret

  redis:
    image: redis:6
```

### Security Notes

- **Never expose Judge0 publicly without authentication**
- Use IP allowlists or API gateway
- Set strict resource limits (CPU, memory, execution time)
- Monitor for abuse patterns

## Python Language ID

Judge0 CE uses the following language IDs:

- Python 3.8.1: `71`
- Python 3.10.0: `92` (if available)

We use `71` (Python 3.8.1) for MVP compatibility.

## API Reference

### Submit Code

```bash
curl -X POST "https://judge0-ce.p.rapidapi.com/submissions" \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: judge0-ce.p.rapidapi.com" \
  -d '{
    "source_code": "print(\"Hello, World!\")",
    "language_id": 71,
    "stdin": ""
  }'
```

### Get Submission

```bash
curl "https://judge0-ce.p.rapidapi.com/submissions/TOKEN" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: judge0-ce.p.rapidapi.com"
```

## Rate Limits

RapidAPI enforces rate limits based on your plan:

- Free: ~50 requests/day
- Basic: ~500 requests/day
- Pro: Unlimited (paid)

Our app-level rate limits:

- `RUN_CODE`: max 1 per 2 seconds per player
- `SUBMIT_CODE`: max 1 per 3 seconds per player
