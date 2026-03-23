from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.config import settings
from supabase import create_client, Client

router = APIRouter(prefix="/api/chats", tags=["chats"])

# Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# Pydantic models
class ChatCreate(BaseModel):
    user_id: str
    title: Optional[str] = "Nieuwe chat"

class ChatUpdate(BaseModel):
    title: Optional[str] = None
    favorite: Optional[bool] = None
    has_notes: Optional[bool] = None

class MessageCreate(BaseModel):
    role: str
    content: str
    tokens_used: Optional[int] = 0
    model_used: Optional[str] = "gpt-4"

class ChatResponse(BaseModel):
    id: str
    user_id: str
    title: str
    favorite: Optional[bool] = False
    has_notes: Optional[bool] = False
    trashed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime


# GET /api/chats?user_id= — Alle chats voor een user (NIET in prullenbak)
@router.get("", response_model=List[ChatResponse])
async def get_chats(user_id: str):
    try:
        response = supabase.table("chats").select("*").eq("user_id", user_id).is_("trashed_at", "null").order("updated_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET /api/chats/trash?user_id= — Alleen chats in prullenbak
@router.get("/trash", response_model=List[ChatResponse])
async def get_trashed_chats(user_id: str):
    try:
        response = supabase.table("chats").select("*").eq("user_id", user_id).not_.is_("trashed_at", "null").order("trashed_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/chats — Nieuwe chat aanmaken
@router.post("", response_model=ChatResponse)
async def create_chat(chat: ChatCreate):
    try:
        response = supabase.table("chats").insert({
            "user_id": chat.user_id,
            "title": chat.title,
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET /api/chats/{chat_id}/messages — Berichten ophalen
@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(chat_id: str):
    try:
        response = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at", desc=False).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/chats/{chat_id}/messages — Bericht toevoegen
@router.post("/{chat_id}/messages", response_model=MessageResponse)
async def create_message(chat_id: str, message: MessageCreate):
    try:
        response = supabase.table("messages").insert({
            "chat_id": chat_id,
            "role": message.role,
            "content": message.content,
        }).execute()

        supabase.table("chats").update({
            "updated_at": datetime.now().isoformat()
        }).eq("id", chat_id).execute()

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# PUT /api/chats/{chat_id} — Chat bijwerken (titel, favorite, notes)
@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(chat_id: str, chat: ChatUpdate):
    try:
        update_data = {"updated_at": datetime.now().isoformat()}

        if chat.title is not None:
            update_data["title"] = chat.title
        if chat.favorite is not None:
            update_data["favorite"] = chat.favorite
        if chat.has_notes is not None:
            update_data["has_notes"] = chat.has_notes

        response = supabase.table("chats").update(update_data).eq("id", chat_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Chat not found")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# PUT /api/chats/{chat_id}/trash — Naar prullenbak
@router.put("/{chat_id}/trash")
async def trash_chat(chat_id: str):
    try:
        response = supabase.table("chats").update({
            "trashed_at": datetime.now().isoformat()
        }).eq("id", chat_id).execute()
        return {"message": "Chat moved to trash"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# PUT /api/chats/{chat_id}/restore — Uit prullenbak halen
@router.put("/{chat_id}/restore")
async def restore_chat(chat_id: str):
    try:
        response = supabase.table("chats").update({
            "trashed_at": None
        }).eq("id", chat_id).execute()
        return {"message": "Chat restored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DELETE /api/chats/{chat_id} — Permanent verwijderen
@router.delete("/{chat_id}")
async def delete_chat(chat_id: str):
    try:
        # Eerst berichten verwijderen
        supabase.table("messages").delete().eq("chat_id", chat_id).execute()
        # Dan chat verwijderen
        supabase.table("chats").delete().eq("id", chat_id).execute()
        return {"message": "Chat permanently deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))