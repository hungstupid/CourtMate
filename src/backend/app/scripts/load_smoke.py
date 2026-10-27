"""Small liveness/readiness probe, not business concurrency/NFR evidence."""

import argparse
from concurrent.futures import ThreadPoolExecutor

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    if not args.base_url.startswith(("http://localhost:", "http://127.0.0.1:")):
        parser.error("This smoke load tool is restricted to localhost.")
    with httpx.Client(base_url=args.base_url, timeout=15) as client:
        with ThreadPoolExecutor(max_workers=5) as pool:
            responses = list(pool.map(lambda _: client.get("/health"), range(20)))
    assert all(response.status_code == 200 for response in responses)
    print(
        "20 liveness requests / 5 workers: PASS. "
        "No business concurrency or performance NFR was tested."
    )


if __name__ == "__main__":
    main()
