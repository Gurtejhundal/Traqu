def smart_put(client, url, *, json, headers=None, **kwargs):
    """Submit a fresh revision in older functional fixtures; concurrency tests
    issue real stale requests directly instead of using this helper.
    """
    detail = client.get(url.removesuffix('/smart') + '/export', headers=headers).json()
    return client.put(url, json={"revision": detail.get('revision', 1), **json}, headers=headers, **kwargs)
