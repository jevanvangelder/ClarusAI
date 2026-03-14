from fastapi import APIRouter, HTTPException, Depends
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
    title: str

class MessageCreate(BaseModel):
    chat_id: str
    role: str  # "user" or "assistant"
    content: str
    tokens_used: Optional[int] = 0
    model_used: Optional[str] = "gpt-4"

class Chat(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime

class Message(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime

# GET /api/chats - Get all chats for a user
@router.get("", response_model=List[Chat])
async def get_chats(user_id: str):
    """Get all chats for a specific user"""
    try:
        response = supabase.table("chats").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/chats - Create new chat
@router.post("", response_model=Chat)
async def create_chat(chat: ChatCreate):
    """Create a new chat"""
    try:
        response = supabase.table("chats").insert({
            "user_id": chat.user_id,
            "title": chat.title,
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET /api/chats/{chat_id}/messages - Get all messages in a chat
@router.get("/{chat_id}/messages", response_model=List[Message])
async def get_messages(chat_id: str):
    """Get all messages for a specific chat"""
    try:
        response = supabase.table("messages").select("*").eq("chat_id", chat_id).order("created_at", desc=False).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# POST /api/chats/{chat_id}/messages - Add message to chat
@router.post("/{chat_id}/messages", response_model=Message)
async def create_message(chat_id: str, message: MessageCreate):
    """Add a new message to a chat"""
    try:
        # Insert message
        response = supabase.table("messages").insert({
            "chat_id": chat_id,
            "role": message.role,
            "content": message.content,
            "tokens_used": message.tokens_used,
            "model_used": message.model_used,
        }).execute()
        
        # Update chat's updated_at timestamp
        supabase.table("chats").update({
            "updated_at": datetime.now().isoformat()
        }).eq("id", chat_id).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PUT /api/chats/{chat_id} - Update chat title
@router.put("/{chat_id}", response_model=Chat)
async def update_chat(chat_id: str, chat: ChatUpdate):
    """Update chat title"""
    try:
        response = supabase.table("chats").update({
            "title": chat.title,
            "updated_at": datetime.now().isoformat()
        }).eq("id", chat_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# DELETE /api/chats/{chat_id} - Delete chat (soft delete)
@router.delete("/{chat_id}")
async def delete_chat(chat_id: str):
    """Soft delete a chat (set trashed_at)"""
    try:
        response = supabase.table("chats").update({
            "trashed_at": datetime.now().isoformat()
        }).eq("id", chat_id).execute()
        return {"message": "Chat moved to trash", "chat_id": chat_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))