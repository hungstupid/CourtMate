import http from 'k6/http'
import exec from 'k6/execution'
import { sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const fixture = JSON.parse(open('/fixture.json'))
const base = __ENV.BASE_URL || 'http://host.docker.internal:8017'
const reads = new Trend('srs_read_ms', true)
const writes = new Trend('srs_write_ms', true)
const errors = new Rate('srs_unexpected_errors')
export const options = {
  scenarios: {
    warmup: { executor: 'constant-vus', vus: 30, duration: '5s', gracefulStop: '0s' },
    steady: { executor: 'constant-vus', vus: 30, duration: '60s', startTime: '5s', gracefulStop: '5s' },
  },
  thresholds: { srs_read_ms: ['p(95)<800'], srs_write_ms: ['p(95)<1500'], srs_unexpected_errors: ['rate<0.01'] },
  discardResponseBodies: false,
}
function request(method, path, body, write = false) {
  const result = http.request(method, `${base}${path}`, body === undefined ? null : JSON.stringify(body), {
    headers: { Authorization: `Bearer ${fixture.tokens[(exec.vu.idInTest - 1) % 30]}`, 'Content-Type': 'application/json' }, timeout: '10s',
  })
  if (exec.scenario.name === 'steady') {
    ;(write ? writes : reads).add(result.timings.duration)
    errors.add(result.status >= 500 || result.status === 0 || (result.status >= 400 && result.status !== 409))
  }
  return result
}
export default function () {
  const i = exec.scenario.iterationInTest % 5
  if (i === 0) request('GET', `/api/courts?q=${encodeURIComponent(`Benchmark ${fixture.marker}`)}`)
  else if (i === 1) request('GET', `/api/courts/${fixture.court}`)
  else if (i === 2) request('GET', `/api/courts/${fixture.court}/availability?date=${fixture.date}`)
  else if (i === 3) request('GET', `/api/courts/${fixture.court}/preview`)
  else {
    const offset = (exec.vu.idInTest - 1) % 7
    const slot_ids = fixture.slots.slice(offset, offset + 2)
    const review = request('POST', '/api/bookings/review', { slot_ids }, true)
    if (review.status === 200) {
      const confirm = request('POST', '/api/bookings', { slot_ids, quote: review.json('quote') }, true)
      if (confirm.status === 201) request('POST', `/api/bookings/${confirm.json('id')}/cancel`, undefined, true)
    }
  }
  sleep(1)
}
