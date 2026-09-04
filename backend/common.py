"""Shared list/pagination helpers for routers."""
from core import db, clean


async def paginate(collection, query=None, page=1, page_size=25, sort=None,
                   projection=None):
    query = query or {}
    page = max(1, int(page))
    page_size = min(200, max(1, int(page_size)))
    cursor = db[collection].find(query, projection)
    if sort:
        cursor = cursor.sort(sort)
    total = await db[collection].count_documents(query)
    docs = await cursor.skip((page - 1) * page_size).limit(page_size).to_list(page_size)
    return {"items": [clean(d) for d in docs], "total": total,
            "page": page, "page_size": page_size,
            "pages": (total + page_size - 1) // page_size}
