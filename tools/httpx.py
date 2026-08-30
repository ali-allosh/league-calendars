# -*- coding: utf-8 -*-
"""Tiny HTTP helper with retries + gzip handling (stdlib only)."""
import gzip
import json
import time
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url, *, timeout=25, retries=4, backoff=1.5, accept="application/json"):
    """GET a URL, return (status, bytes). Raises last error after retries."""
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Accept": accept,
            "Accept-Encoding": "gzip",
        })
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
                if r.headers.get("content-encoding") == "gzip":
                    body = gzip.decompress(body)
                return r.status, body
        except urllib.error.HTTPError as e:
            body = b""
            try:
                body = e.read()
                if e.headers.get("content-encoding") == "gzip":
                    body = gzip.decompress(body)
            except Exception:
                pass
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                last = e
                time.sleep(backoff * (attempt + 1))
                continue
            return e.code, body
        except Exception as e:  # timeouts, connection resets …
            last = e
            if attempt < retries - 1:
                time.sleep(backoff * (attempt + 1))
                continue
            raise
    if last:
        raise last
    raise RuntimeError("unreachable")


def get_json(url, **kw):
    status, body = get(url, **kw)
    if status != 200:
        raise RuntimeError(f"HTTP {status} for {url[:110]}")
    return json.loads(body)


def download(url, **kw):
    kw.setdefault("accept", "*/*")
    status, body = get(url, **kw)
    if status != 200:
        raise RuntimeError(f"HTTP {status} for {url[:110]}")
    return body
