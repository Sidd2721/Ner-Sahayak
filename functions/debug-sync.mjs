import fetch from 'node-fetch';

async function run() {
  const url = `http://127.0.0.1:5001/sih2026-ce822/us-central1/syncMutationQueue`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { id: "test-id", payload: { reporterId: "test", type: "road-blocked", severity: 3, geohash: "abc", corridorId: "nh-27", lat: 25, lng: 93, status: "unconfirmed" } } }),
  });
  console.log("STATUS:", res.status);
  console.log("TEXT:", await res.text());
}
run();
