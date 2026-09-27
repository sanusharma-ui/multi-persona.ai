"""Validate access tokens with Supabase; client-supplied user IDs are never trusted."""

import os
from uuid import UUID

import httpx
from fastapi import HTTPException, Request


async def authenticate(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or len(parts[1]) > 16384:
        raise HTTPException(401, "Please sign in to continue.", headers={"WWW-Authenticate": "Bearer"})

    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip() or os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not url or not key:
        raise HTTPException(503, "Sign-in is temporarily unavailable. Please try again later.")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{url}/auth/v1/user",
                headers={"apikey": key, "Authorization": f"Bearer {parts[1]}"},
            )
        if response.status_code in (401, 403):
            raise HTTPException(401, "Your session has expired. Please sign in again.", headers={"WWW-Authenticate": "Bearer"})
        if response.status_code != 200:
            raise HTTPException(503, "Sign-in is temporarily unavailable. Please try again later.")
        user = response.json()
        if user.get("is_anonymous") or user.get("aud") != "authenticated":
            raise HTTPException(401, "Please sign in with your account.")
        return str(UUID(user["id"]))
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise HTTPException(503, "Could not verify your session. Please try again.") from exc
