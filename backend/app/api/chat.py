from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db, init_db
from app.models.database import User, Conversation, Message, UserRole
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Request/Response models
class ChatMessage(BaseModel):
    content: str

class ChatResponse(BaseModel):
    message: str
    conversation_id: int
    timestamp: datetime

class ConversationHistory(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

# Initialize database on startup
@router.on_event("startup")
async def startup():
    init_db()

# Send a chat message
@router.post("/send", response_model=ChatResponse)
async def send_message(
    message: ChatMessage,
    conversation_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Send a message and get AI response
    
    For now, we'll use a default test user (user_id=1)
    Later we'll add authentication
    """
    
    # Get or create test user (temporary, until we add auth)
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(
            email="test@clarusai.nl",
            username="testuser",
            hashed_password="temp",
            full_name="Test User",
            role=UserRole.STUDENT
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Get or create conversation
    if conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            user_id=user.id,
            title=message.content[:50]  # Use first 50 chars as title
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    db.commit()
    
    # Get conversation history for context
    messages = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at).all()
    
    # Format messages for OpenAI
    message_history = [
        {"role": msg.role, "content": msg.content}
        for msg in messages
    ]
    
    # Generate AI response
    ai_response = await ai_service.generate_response(
        messages=message_history,
        role=user.role.value
    )
    
    # Save AI response
    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=ai_response
    )
    db.add(assistant_message)
    db.commit()
    
    return ChatResponse(
        message=ai_response,
        conversation_id=conversation.id,
        timestamp=assistant_message.created_at
    )

# Get conversation history
@router.get("/history/{conversation_id}", response_model=List[ConversationHistory])
async def get_conversation_history(
    conversation_id: int,
    db: Session = Depends(get_db)
):
    """Get all messages in a conversation"""
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at).all()
    
    return [
        ConversationHistory(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at
        )
        for msg in messages
    ]
    